/**
 * server.js — Vercel entrypoint shim
 *
 * Vercel's Node.js zero-config detection scans for a conventional
 * root-level server file (server.js / index.js) and looks for one that
 * calls httpServer.listen(). The real app is a Vite SSR build, so it
 * doesn't exist at this path until `npm run build` has produced
 * dist/server.bundle.mjs.
 *
 * Importing that bundle runs its side effects: it constructs the Express
 * app, wraps it in an http.Server, and calls listen() on
 * process.env.PORT (already correct in src/server/entry.ts — Vercel sets
 * PORT itself; the bound port is only meaningful for local dev, per
 * Vercel's Node.js Server docs).
 */
import './dist/server.bundle.mjs';
