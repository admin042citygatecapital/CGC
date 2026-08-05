/**
 * api/index.ts — Vercel serverless entrypoint for the City Gate Capital app.
 * ───────────────────────────────────────────────────────────────────────────
 * Vercel has no persistent process, so it cannot run the Express server's
 * `listen()` path. Instead, every request is rewritten (see vercel.json) to
 * this function, which hands the raw Node req/res to the built Express app.
 *
 * Why load the built bundle at runtime (not a static import):
 *   `dist/server.bundle.mjs` is the self-contained SSR build of
 *   src/server/entry.ts. It reads its own on-disk assets relative to its
 *   location — `dist/client/index.html` (via import.meta.url → dirname) and
 *   its code-split chunks in `dist/bin/`. Importing it with a *computed*
 *   specifier keeps Vercel's bundler from re-bundling it, so those relative
 *   paths keep resolving against `dist/` at runtime. `includeFiles: "dist/**"`
 *   in vercel.json ships the whole `dist/` tree into the function.
 *
 * The exported `ready` promise resolves once the app's static + SSR middleware
 * is fully attached; we await it before serving so the first request on a cold
 * start never races the async wiring. The `VERCEL` env var (set automatically
 * by the platform) makes entry.ts skip `listen()` and the WebSocket/background
 * workers.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

type NodeHandler = (req: IncomingMessage, res: ServerResponse) => void;

interface ServerBundle {
  default: NodeHandler;
  ready: Promise<void>;
}

let cached: ServerBundle | null = null;

async function loadServer(): Promise<ServerBundle> {
  if (cached) return cached;
  const bundlePath = path.join(process.cwd(), "dist", "server.bundle.mjs");
  // Computed specifier via pathToFileURL: opaque to the function bundler, so
  // the pre-built ESM bundle loads as-is with its own import.meta.url intact.
  cached = (await import(pathToFileURL(bundlePath).href)) as unknown as ServerBundle;
  return cached;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const { default: app, ready } = await loadServer();
    await ready;
    return app(req, res);
  } catch (err) {
    // A failure here means the server bundle could not load or configure —
    // surface it as JSON rather than a blank 500 so it is diagnosable.
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: "vercel.handler.bootstrap_failed", error: message }));
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Server bootstrap failed", message }));
    }
  }
}
