/**
 * INVO: connects this game to INVO. Out of the box it runs on INVO's public demo sandbox, so a
 * fresh fork works with no setup. Going live is two Secrets and nothing else in the code:
 *
 *   INVO_GAME_SECRET     your game secret from the INVO console (replaces the demo key)
 *   INVO_WEBHOOK_SECRET  your webhook signing secret from the INVO console
 *
 * The SDK picks sandbox or production from the key, so INVO_ENV stays unset.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  invoGameServerFromEnv,
  isDemoKey,
  registerProject,
  type GameStore,
  type InvoGameServerSetup,
} from "@invonetwork/web-sdk/game-server";
import { economy } from "../shared/economy.js";

/**
 * INVO's public demo key. It is safe in source by design: it only reaches a sandbox-locked demo
 * app (test cards, fictional players) and INVO refuses it in production. It is used only while
 * INVO_GAME_SECRET is not set.
 */
export const INVO_DEMO_KEY = "ivsdk_demo_di0Hc02bxzbsM4vcZIZFY69gyb3C3sd2jtQIDHJus9A";

export interface InvoConnection {
  setup: InvoGameServerSetup;
  /** True while running on the public demo key. */
  demo: boolean;
  /** This copy's project id (`proj_...`), when known. Not a secret. */
  projectId: string | null;
  /** The public origin, when this copy has one (Replit sets it automatically). */
  publicUrl: string | null;
  /** Why checkout credits cannot arrive yet, when they cannot. */
  webhookProblem: string | null;
}

/** The public origin of this copy: PUBLIC_URL, else Replit's deployment or workspace domain. */
export function publicUrlFrom(env: Record<string, string | undefined>): string | null {
  const explicit = env["PUBLIC_URL"]?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const deployed = env["REPLIT_DEPLOYMENT"] ? env["REPLIT_DOMAINS"]?.split(",")[0]?.trim() : undefined;
  const domain = deployed || env["REPLIT_DEV_DOMAIN"]?.trim() || env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
  return domain ? `https://${domain}` : null;
}

export async function connectInvo(options: {
  env: Record<string, string | undefined>;
  store: GameStore;
  root: string;
  log?: (message: string) => void;
  /** Tests only: stands in for INVO. */
  fetch?: typeof fetch;
}): Promise<InvoConnection> {
  const { env, store } = options;
  const gameSecret = env["INVO_GAME_SECRET"]?.trim() || INVO_DEMO_KEY;
  const demo = isDemoKey(gameSecret);
  const publicUrl = publicUrlFrom(env);
  // Holds the project id, and for the demo the webhook secret and registration token.
  // It is in .gitignore: never commit it.
  const projectFile = path.join(options.root, ".invo", "project.json");

  let webhookSecret: string | undefined;
  let webhookProblem: string | null = null;
  let projectId: string | null = null;
  if (demo && !env["INVO_WEBHOOK_SECRET"]?.trim()) {
    if (publicUrl) {
      try {
        // Registers this copy with the demo sandbox on every start (a no-op when nothing
        // changed). A remix gets its own project id automatically.
        const project = await registerProject({ gameSecret, webhookUrl: `${publicUrl}/api/invo/webhook`, file: projectFile, fetch: options.fetch });
        projectId = project.projectId;
        if (!project.webhookSecret) webhookProblem = "INVO did not return a webhook secret for this project.";
      } catch (err) {
        webhookProblem = err instanceof Error ? err.message : String(err);
      }
    } else {
      webhookProblem = "this copy has no public URL. The demo sandbox delivers checkout webhooks only to *.replit.app, *.replit.dev and *.repl.co, so run it on Replit to test checkout.";
    }
    if (webhookProblem) {
      // Everything except checkout crediting still works locally. A random local secret keeps
      // the webhook route closed: nothing can sign a request with it.
      webhookSecret = `local-${randomBytes(24).toString("hex")}`;
      options.log?.(`INVO: checkout credits are off: ${webhookProblem}`);
    }
  }

  const setup = invoGameServerFromEnv({
    economy,
    env: { ...env, INVO_GAME_SECRET: gameSecret, ...(publicUrl ? { PUBLIC_URL: publicUrl } : {}) },
    store,
    projectFile,
    ...(webhookSecret ? { webhookSecret } : {}),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  projectId ??= env["INVO_PROJECT_ID"]?.trim() || readProjectId(projectFile);
  return { setup, demo, projectId, publicUrl, webhookProblem };
}

function readProjectId(file: string): string | null {
  try {
    // Written by the SDK; read only to show it in the start-up message.
    const id = (JSON.parse(readFileSync(file, "utf8")) as { projectId?: unknown }).projectId;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}
