/**
 * PostgreSQL connection — City Gate Capital.
 *
 * Uses postgres.js over the PostgreSQL wire protocol so the production build
 * works with standard managed PostgreSQL providers, including Supabase.
 * Pool size is intentionally bounded because each
 * application instance owns its own pool.
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { getSecret } from '#runtime/secrets';
import * as schema from './schema.js';

let database: ReturnType<typeof drizzle<typeof schema>> | null = null;
let queryClient: ReturnType<typeof postgres> | null = null;

function getPoolSize(): number {
  const configured = Number.parseInt(process.env.DATABASE_POOL_SIZE ?? '10', 10);
  return Number.isInteger(configured) && configured >= 1 && configured <= 20 ? configured : 10;
}

function getUrl(): string {
  return String(
    getSecret('DATABASE_URL') ||
    process.env.DATABASE_URL ||
    ''
  ).trim();
}

function createClient(): ReturnType<typeof postgres> | null {
  const url = getUrl();
  if (!url) return null;

  const ssl = resolveSsl(url);
  return postgres(url, {
    max: getPoolSize(),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    // Omit the key when the URL governs TLS: an explicitly passed `undefined`
    // would shadow the URL's sslmode and silently downgrade to plaintext.
    ...(ssl === undefined ? {} : { ssl }),
  });
}

/**
 * Managed PostgreSQL providers (Supabase, Neon, Render) reject unencrypted
 * connections at pg_hba, and postgres.js only enables TLS when the URL carries
 * an sslmode parameter or an explicit ssl option. Require TLS for every host
 * that is not loopback, leaving an explicit sslmode in the URL authoritative.
 * Returns undefined when the URL already carries sslmode — the caller must
 * omit the ssl option entirely so the URL's value stays authoritative.
 */
function resolveSsl(url: string): boolean | undefined {
  if (/sslmode=/.test(url)) return undefined;
  if (/localhost|127\.0\.0\.1|::1/.test(url)) return false;
  return true;
}

export function getQueryClient(): ReturnType<typeof postgres> {
  if (!queryClient) {
    const client = createClient();
    if (!client) {
      throw new Error('Database not configured');
    }
    queryClient = client;
  }
  return queryClient;
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!database) database = drizzle(getQueryClient(), { schema });
  return database;
}

export async function closeConnection(): Promise<void> {
  if (!queryClient) return;
  const client = queryClient;
  queryClient = null;
  database = null;
  await client.end({ timeout: 5 });
}

export function isDatabaseConfigured(): boolean {
  return getUrl().length > 0;
}

export async function testConnection(): Promise<{ ok: boolean; error?: string; latencyMs?: number }> {
  const start = Date.now();
  try {
    await getQueryClient()`SELECT 1 AS ping`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: String(err), latencyMs: Date.now() - start };
  }
}

export { schema };
export type { User, NewUser, Transaction, NewTransaction, Card, NewCard } from './schema.js';
