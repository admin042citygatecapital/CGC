/**
 * TLS posture for PostgreSQL connections.
 *
 * Managed providers (Supabase, Neon, Render) reject unencrypted connections
 * at pg_hba, and postgres.js only enables TLS when the URL carries an sslmode
 * parameter or an explicit ssl option. Boolean `true` is not that option: it
 * leaves certificate verification on, which fails against provider chains
 * Node does not trust. The string `'require'` is postgres.js's encrypted,
 * unverified mode — matching libpq's sslmode=require. Loopback keeps
 * plaintext; an explicit sslmode in the URL stays authoritative.
 */
export function resolveSsl(url: string): 'require' | false | undefined {
  if (/sslmode=/.test(url)) return undefined;
  if (/localhost|127\.0\.0\.1|::1/.test(url)) return false;
  return 'require';
}