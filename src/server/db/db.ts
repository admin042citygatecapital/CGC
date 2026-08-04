/**
 * Postgres (Neon) connection via drizzle-orm's neon-http driver. Stateless
 * HTTP-based client — no pool lifecycle to manage per request, matching how
 * these route handlers already run one-shot per invocation.
 *
 * Every call site in src/server/lib/*Store.ts guards with
 * `isDatabaseConfigured()` before calling `getDb()` synchronously and never
 * null-checks the result, so `getDb()` throws rather than returning a
 * nullable value if called without that guard.
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

let cached: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('getDb() called without DATABASE_URL configured — guard with isDatabaseConfigured() first.');
    }
    cached = drizzle(neon(url), { schema });
  }
  return cached;
}
