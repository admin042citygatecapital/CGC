/**
 * Vercel catch-all API function.
 *
 * The Express application contains the existing `/api/*` routing, security,
 * authentication and audit middleware. Importing it with VERCEL=1 keeps all
 * long-lived container lifecycle features disabled.
 */
export { default } from '../src/server/entry.js';
