/**
 * Database connection — City Gate Capital
 *
 * Uses the Neon serverless HTTP driver (@neondatabase/serverless).
 * Communicates over HTTPS (port 443) — works in the preview sandbox,
 * Vercel serverless functions, and any environment that restricts outbound TCP.
 *
 * Compatible with:
 *   - Neon Postgres (pooler URL recommended for queries)
 *   - Supabase Postgres (use the "Transaction" pooler URL from Supabase Dashboard
 *     → Project Settings → Database → Connection string → URI)
 *
 * Connection strategy:
 *   - Queries (SELECT/INSERT/UPDATE/DELETE): pooler URL (high concurrency)
 *   - DDL (CREATE/ALTER/DROP): direct URL (Neon pooler blocks DDL in transaction mode;
 *     Supabase's pooler also requires direct URL for DDL — use the "Session" mode URL)
 *
 * Set the connection string via: Settings → Secrets → DATABASE_URL
 * Aliases also accepted: NEON_CONNECTION_STRING, SUPABASE_DB_URL
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon }    from '@neondatabase/serverless';
import { getSecret } from '#airo/secrets';
import * as schema from './schema.js';

// ── Singleton ─────────────────────────────────────────────────────────────────

let _db:    ReturnType<typeof drizzle<typeof schema>> | null = null;
let _ddlSql: ReturnType<typeof neon> | null = null;

function getUrl(): string {
  // Prefer NEON_CONNECTION_STRING if it's a valid pooler URL (it was updated to the correct
  // eu-west-1 pooler URL).  Fall back to DATABASE_URL (direct port 5432 — auto-converted
  // to pooler by toSupabasePoolerUrl below) or SUPABASE_DB_URL.
  return String(
    getSecret('NEON_CONNECTION_STRING') ||
    getSecret('DATABASE_URL') ||
    getSecret('SUPABASE_DB_URL') ||
    process.env.DATABASE_URL ||
    ''
  ).trim();
}

/**
 * Normalise a Supabase direct URL (port 5432) to the Transaction pooler URL (port 6543).
 *
 * The Neon HTTP driver communicates over HTTPS (port 443) and cannot open a raw
 * TCP socket to port 5432.  Supabase exposes a PgBouncer-based Transaction pooler
 * at *.pooler.supabase.com:6543 that the Neon driver CAN reach.
 *
 * Direct URL pattern:
 *   postgresql://postgres:[pass]@db.[ref].supabase.co:5432/postgres
 * Pooler URL pattern:
 *   postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 * The region is inferred from the project ref's first segment; we default to
 * us-east-1 which is correct for most Supabase projects.  If the URL is already
 * a pooler URL (contains ".pooler.supabase.com") it is returned unchanged.
 */
function toSupabasePoolerUrl(url: string): string {
  // Already a pooler URL — nothing to do
  if (url.includes('.pooler.supabase.com')) return url;

  const directMatch = url.match(/db\.([a-z0-9]+)\.supabase\.co/);
  if (!directMatch) return url; // not a Supabase direct URL

  try {
    const projectRef = directMatch[1];
    const parsed     = new URL(url);
    const password   = parsed.password;
    const dbName     = parsed.pathname.replace(/^\//, '') || 'postgres';
    // Region confirmed from NEON_CONNECTION_STRING: aws-0-eu-west-1.pooler.supabase.com
    const poolerHost = `aws-0-eu-west-1.pooler.supabase.com`;
    return `postgresql://postgres.${projectRef}:${password}@${poolerHost}:6543/${dbName}?sslmode=require`;
  } catch {
    return url; // malformed URL — return as-is and let the driver surface the error
  }
}

/** Direct URL (no pooler) — required for DDL statements.
 *  - Neon:     strips "-pooler." from hostname
 *  - Supabase: strips "?pgbouncer=true" and "?pgbouncer=true&..." query params
 *              (Supabase transaction-mode pooler adds these; direct URL doesn't need them)
 *  - Other:    returns URL unchanged (no-op)
 */
function getDirectUrl(url: string): string {
  // Neon pooler: ep-xxx-pooler.region.aws.neon.tech → ep-xxx.region.aws.neon.tech
  let direct = url.replace(/-pooler\./, '.');
  // Supabase pgbouncer param (transaction mode pooler)
  direct = direct.replace(/[?&]pgbouncer=true/g, '').replace(/[?&]$/, '');
  return direct;
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (_db) return _db;

  const rawUrl = getUrl();
  if (!rawUrl) {
    throw new Error(
      'DATABASE_URL is not set. Add it in Settings → Secrets.\n' +
      'Format: postgresql://user:password@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require'
    );
  }

  // Auto-convert Supabase direct URL (port 5432) to Transaction pooler URL (port 6543).
  // The Neon HTTP driver communicates over HTTPS and cannot open raw TCP to port 5432.
  const url = toSupabasePoolerUrl(rawUrl);

  const sql = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

/** Get a direct (non-pooler) Neon client for DDL statements */
export function getDdlClient(): ReturnType<typeof neon> {
  if (_ddlSql) return _ddlSql;
  const rawUrl = getUrl();
  if (!rawUrl) throw new Error('DATABASE_URL is not set');
  // For DDL: use pooler URL (Supabase Transaction pooler supports DDL in session mode)
  const url = toSupabasePoolerUrl(rawUrl);
  _ddlSql = neon(getDirectUrl(url));
  return _ddlSql;
}

/**
 * Check if DATABASE_URL is configured.
 */
export function isDatabaseConfigured(): boolean {
  return getUrl().length > 0;
}

/**
 * Test the database connection (HTTPS ping via pooler).
 */
export async function testConnection(): Promise<{ ok: boolean; error?: string; latencyMs?: number }> {
  const start = Date.now();
  try {
    const db = getDb();
    await db.execute('SELECT 1 as ping' as unknown as Parameters<typeof db.execute>[0]);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: String(err), latencyMs: Date.now() - start };
  }
}

// Re-export schema for convenience
export { schema };
export type { User, NewUser, Transaction, NewTransaction, Card, NewCard } from './schema.js';
