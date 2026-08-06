/**
 * Postgres connection via drizzle-orm's postgres-js driver.
 *
 * Uses postgres.js rather than the Neon HTTP driver because the database is
 * Supabase Postgres: the Neon driver speaks Neon's HTTP protocol and cannot
 * open the TCP connection Supabase requires. postgres.js opens a real socket,
 * so it works against Supabase's pooler and direct endpoints alike.
 *
 * `prepare: false` is required when DATABASE_URL points at Supabase's
 * transaction-mode pooler (port 6543 / PgBouncer), which does not support
 * prepared statements. It is harmless on a direct or session-mode connection.
 *
 * `max: 1` keeps a single connection per serverless invocation — these route
 * handlers run one-shot, and a larger pool would only hold idle sockets open
 * against the pooler's connection limit.
 *
 * Every call site in src/server/lib/*Store.ts guards with
 * `isDatabaseConfigured()` before calling `getDb()` synchronously and never
 * null-checks the result, so `getDb()` throws rather than returning a
 * nullable value if called without that guard.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
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
    const sql = postgres(url, { max: 1, ssl: 'require', prepare: false });
    cached = drizzle(sql, { schema });
  }
  return cached;
}
