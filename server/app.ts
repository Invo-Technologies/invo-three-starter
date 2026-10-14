/**
 * The game's server: INVO's economy routes at /api/invo, and the game itself on every other
 * path (Vite with hot reload in development, the built files in production). One port.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";
import { toNodeListener } from "@invonetwork/web-sdk/game-server";
import { connectInvo, type InvoConnection } from "./invo.js";
import { openStore, type StoreKind } from "./store.js";
import { serveStatic } from "./static.js";

export interface AppOptions {
  env?: Record<string, string | undefined>;
  /** Project folder (holds `dist/`, `.data/` and `.invo/`). Default: the current directory. */
  root?: string;
  /** Serve through Vite with hot reload. Default: on unless `--production` or NODE_ENV=production. */
  dev?: boolean;
  log?: (message: string) => void;
  /** Tests only: stands in for INVO. */
  fetch?: typeof fetch;
}

export interface App {
  httpServer: Server;
  invo: InvoConnection;
  storeKind: StoreKind;
  close(): Promise<void>;
}

export async function createApp(options: AppOptions = {}): Promise<App> {
  const env = options.env ?? process.env;
  const root = path.resolve(options.root ?? process.cwd());
  const dev = options.dev ?? !(process.argv.includes("--production") || env["NODE_ENV"] === "production");

  const { store, kind: storeKind } = await openStore(env, path.join(root, ".data"));
  // INVO: everything economy-related comes from here (see server/invo.ts).
  const invo = await connectInvo({ env, store, root, log: options.log ?? console.log, fetch: options.fetch });

  const httpServer = createServer();
  let page: (req: IncomingMessage, res: ServerResponse) => unknown;
  let closeVite = async () => {};
  if (dev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root,
      appType: "spa",
      server: { middlewareMode: true, ws: { server: httpServer } },
    });
    page = (req, res) => vite.middlewares(req, res);
    closeVite = () => vite.close();
  } else {
    page = serveStatic(path.join(root, "dist"));
  }
  httpServer.on(
    "request",
    toNodeListener(invo.setup.server, (req, res) => page(req as IncomingMessage, res as ServerResponse)),
  );

  return {
    httpServer,
    invo,
    storeKind,
    async close() {
      await closeVite();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}
