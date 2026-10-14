/**
 * The template's server, booted for real on a free port: the INVO routes on the public demo
 * key (with INVO itself mocked), the built game, and the Postgres ledger.
 */
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { newDb } from "pg-mem";
import { createApp, type App } from "../server/app.js";
import { INVO_DEMO_KEY, publicUrlFrom } from "../server/invo.js";
import { createPostgresGameStore, type PgPoolLike } from "../server/store.js";

const PROJECT_ID = /^proj_[0-9A-HJKMNP-TV-Z]{26}$/;

let app: App | null = null;
let dir = "";

/** A stand-in for INVO's sandbox that records what it was sent. */
function fakeInvo() {
  const calls: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    calls.push({ url, headers: new Headers(init?.headers), body });
    const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
    if (url.endsWith("/api/demo/projects/register")) return reply(201, { webhook: { signing_secret: "whsec_demo_test" }, registration_token: "reg_test" });
    if (url.endsWith("/api/sdk/player-token")) return reply(200, { token: "pt", expires_at: "2099-01-01T00:00:00Z", identity_id: "i" });
    if (url.includes("/api/player-balances/")) {
      return reply(200, { player: {}, summary: {}, balances: [{ currency_name: "Gems", available_balance: "0.00", reserved_balance: "0.00", total_balance: "0.00" }] });
    }
    return reply(404, { error_code: "NOT_FOUND" });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

async function boot(env: Record<string, string | undefined> = {}, fetchImpl?: typeof fetch) {
  dir = await mkdtemp(path.join(tmpdir(), "invo-template-"));
  await mkdir(path.join(dir, "dist", "assets"), { recursive: true });
  await writeFile(path.join(dir, "dist", "index.html"), "<!doctype html><title>game</title>");
  await writeFile(path.join(dir, "dist", "assets", "app-abc.js"), "console.log(1)");
  await writeFile(path.join(dir, "secret.txt"), "do not serve");
  app = await createApp({ env, root: dir, dev: false, log: () => undefined, fetch: fetchImpl });
  await new Promise<void>((resolve) => app!.httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = app.httpServer.address() as AddressInfo;
  return (p: string, init?: RequestInit) => fetch(`http://127.0.0.1:${port}${p}`, init);
}

afterEach(async () => {
  await app?.close();
  app = null;
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe("template server on the public demo key", () => {
  it("works with no secrets: registers the copy, keeps its secret out of reach, and signs players in as demo players", async () => {
    const invo = fakeInvo();
    const get = await boot({ PUBLIC_URL: "https://shard-arena.replit.app" }, invo.fetchImpl);
    expect(app!.invo.demo).toBe(true);
    expect(app!.invo.webhookProblem).toBeNull();
    expect(app!.invo.setup.missing).toEqual([]);
    expect(app!.invo.projectId).toMatch(PROJECT_ID);

    const register = invo.calls.find((c) => c.url.endsWith("/api/demo/projects/register"))!;
    expect(register.body["webhook_url"]).toBe("https://shard-arena.replit.app/api/invo/webhook");
    expect(register.headers.get("x-game-secret-key")).toBe(INVO_DEMO_KEY);
    const saved = JSON.parse(await readFile(path.join(dir, ".invo", "project.json"), "utf8")) as Record<string, string>;
    expect(saved["projectId"]).toBe(app!.invo.projectId);
    expect(saved["webhookSecret"]).toBe("whsec_demo_test");

    const health = await (await get("/api/invo/health")).text();
    expect(JSON.parse(health)).toMatchObject({ setupRequired: false, sandbox: true });
    expect(health).not.toContain("whsec_demo_test");
    // Transfers and sends are on with the demo key, between players of this project.
    expect(await (await get("/api/invo/transfers/status")).json()).toMatchObject({ enabled: true, demo: true, scope: "project" });

    const session = await get("/api/invo/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "Real.Person@gmail.com", phone: "+447700900123" }) });
    expect(session.status).toBe(200);
    const mint = invo.calls.find((c) => c.url.endsWith("/api/sdk/player-token"))!;
    expect(String(mint.body["player_email"])).toMatch(/@demo\.invo\.network$/);
    expect(String(mint.body["player_phone"])).toMatch(/^\+1\d{3}55501\d{2}$/); // any fictional NPA-555-01XX
    expect(mint.headers.get("x-invo-project-id")).toBe(app!.invo.projectId);
  });

  it("still runs without a public URL, with checkout credits off and the webhook closed", async () => {
    const invo = fakeInvo();
    const get = await boot({}, invo.fetchImpl);
    expect(app!.invo.demo).toBe(true);
    expect(app!.invo.webhookProblem).toMatch(/public URL/);
    expect(app!.invo.setup.missing).toEqual([]);
    expect(invo.calls.some((c) => c.url.endsWith("/api/demo/projects/register"))).toBe(false);
    const hook = await get("/api/invo/webhook", { method: "POST", body: "{}" });
    expect(hook.status).toBe(400);
  });

  it("goes live by swapping the secrets: no registration, no demo key", async () => {
    const invo = fakeInvo();
    const get = await boot({ INVO_GAME_SECRET: "live-secret", INVO_WEBHOOK_SECRET: "whsec_live", INVO_ENV: "production" }, invo.fetchImpl);
    expect(app!.invo.demo).toBe(false);
    expect(app!.invo.setup.environment).toBe("production");
    expect(await (await get("/api/invo/transfers/status")).json()).toMatchObject({ enabled: true, scope: "network" });
    expect(invo.calls.some((c) => c.url.endsWith("/api/demo/projects/register"))).toBe(false);
  });

  it("finds this copy's public URL on Replit", () => {
    expect(publicUrlFrom({ REPLIT_DEV_DOMAIN: "abc.picard.replit.dev" })).toBe("https://abc.picard.replit.dev");
    expect(publicUrlFrom({ REPLIT_DEPLOYMENT: "1", REPLIT_DOMAINS: "shard-arena.replit.app,www.example.com", REPLIT_DEV_DOMAIN: "x.replit.dev" })).toBe("https://shard-arena.replit.app");
    expect(publicUrlFrom({ PUBLIC_URL: "https://mygame.com/", REPLIT_DEV_DOMAIN: "x.replit.dev" })).toBe("https://mygame.com");
    expect(publicUrlFrom({})).toBeNull();
  });
});

describe("serving the game", () => {
  it("serves the built game with an SPA fallback and long-cached assets", async () => {
    const get = await boot({}, fakeInvo().fetchImpl);
    const page = await get("/");
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect((await get("/some/route")).status).toBe(200);
    expect((await get("/assets/app-abc.js")).headers.get("cache-control")).toContain("immutable");
    expect((await get("/assets/missing.js")).status).toBe(404);
    const catalog = (await (await get("/api/invo/catalog")).json()) as { items: Array<{ id: string }> };
    expect(catalog.items.map((i) => i.id)).toEqual(["crown_of_light", "shard_magnet"]);
  });

  it("never serves files outside dist/", async () => {
    const get = await boot({}, fakeInvo().fetchImpl);
    for (const p of ["/../secret.txt", "/%2e%2e/secret.txt", "/..%2fsecret.txt", "/../.invo/project.json"]) {
      expect(await (await get(p)).text()).not.toContain("do not serve");
    }
  });
});

describe("Postgres ledger", () => {
  it("persists changes and rolls back a failed transaction", async () => {
    const { Pool } = newDb().adapters.createPg();
    const pool = new Pool() as unknown as PgPoolLike;
    const store = await createPostgresGameStore(pool);
    await store.transact((s) => {
      s.inventory["p_1"] = { crown_of_light: 1 };
    });
    await expect(
      store.transact((s) => {
        s.inventory["p_1"] = { crown_of_light: 99 };
        throw new Error("refused");
      }),
    ).rejects.toThrow("refused");
    expect(await store.read((s) => s.inventory["p_1"])).toEqual({ crown_of_light: 1 });
    const { rows } = await pool.query("SELECT state FROM invo_game_state WHERE id = 1");
    expect((rows[0]?.["state"] as { inventory: unknown }).inventory).toEqual({ p_1: { crown_of_light: 1 } });
  });
});
