/**
 * INVO: where the server keeps its ledger (coins, owned items, sessions, which purchases were
 * already credited). The economy rules live in @invonetwork/web-sdk; this file only picks
 * the storage.
 *
 * - With `DATABASE_URL` set (on Replit: add a PostgreSQL database), the ledger lives in
 *   Postgres and survives redeploys. Use this before you go live.
 * - Otherwise it is a JSON file in `.data/`, which is fine while you build but is reset when
 *   a Replit deployment is republished.
 */
import path from "node:path";
import {
  createFileGameStore,
  emptyGameState,
  type GameStore,
  type GameStoreState,
} from "@invonetwork/web-sdk/game-server";

export type StoreKind = "postgres" | "file";

/** The slice of `pg.Pool` this store uses (so tests can pass an in-memory one). */
export interface PgPoolLike {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  connect(): Promise<{
    query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
    release(): void;
  }>;
}

export async function openStore(env: Record<string, string | undefined>, dataDir: string): Promise<{ store: GameStore; kind: StoreKind }> {
  const url = env["DATABASE_URL"]?.trim();
  if (url) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: url, max: 4 });
    return { store: await createPostgresGameStore(pool), kind: "postgres" };
  }
  return { store: createFileGameStore({ file: path.join(dataDir, "invo-ledger.json") }), kind: "file" };
}

/**
 * The whole game state as one JSONB row, changed under a row lock so two server instances
 * can never spend the same coins twice. Simple on purpose; move to real tables when the
 * ledger grows large.
 */
export async function createPostgresGameStore(pool: PgPoolLike): Promise<GameStore> {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS invo_game_state (id INTEGER PRIMARY KEY, state JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
  await pool.query("INSERT INTO invo_game_state (id, state) VALUES (1, $1) ON CONFLICT (id) DO NOTHING", [JSON.stringify(emptyGameState())]);

  // One transaction at a time from this process; the row lock covers other processes.
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(job: () => Promise<T>): Promise<T> => {
    const run = tail.then(job, job);
    tail = run.catch(() => undefined);
    return run;
  };
  const parse = (value: unknown): GameStoreState => (typeof value === "string" ? JSON.parse(value) : value) as GameStoreState;

  return {
    async read(fn) {
      const { rows } = await pool.query("SELECT state FROM invo_game_state WHERE id = 1");
      return fn(parse(rows[0]?.["state"]));
    },
    transact(fn) {
      return serial(async () => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const { rows } = await client.query("SELECT state FROM invo_game_state WHERE id = 1 FOR UPDATE");
          const state = parse(rows[0]?.["state"]);
          const result = fn(state);
          await client.query("UPDATE invo_game_state SET state = $1, updated_at = now() WHERE id = 1", [JSON.stringify(state)]);
          await client.query("COMMIT");
          return result;
        } catch (err) {
          await client.query("ROLLBACK").catch(() => undefined);
          throw err;
        } finally {
          client.release();
        }
      });
    },
  };
}
