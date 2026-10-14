/** Serves the built game from `dist/` in production (Vite serves it in development). */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

export function serveStatic(dir: string) {
  const root = path.resolve(dir);
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    let urlPath: string;
    try {
      urlPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    } catch {
      res.statusCode = 400;
      res.end("Bad request");
      return;
    }
    let file = path.resolve(root, "." + urlPath);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      file = path.join(file, "index.html");
      info = await stat(file).catch(() => null);
    }
    if (!info) {
      // Unknown asset: 404. Unknown page (no extension): the game's index.html.
      if (path.extname(urlPath)) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }
      file = path.join(root, "index.html");
      info = await stat(file).catch(() => null);
      if (!info) {
        res.statusCode = 503;
        res.end("The game is not built yet: run `npm run build`.");
        return;
      }
    }
    res.statusCode = 200;
    res.setHeader("content-type", TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream");
    res.setHeader("x-content-type-options", "nosniff");
    // Vite puts hashed files in /assets/: cache them forever, everything else revalidates.
    res.setHeader("cache-control", urlPath.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
  };
}
