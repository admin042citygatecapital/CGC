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
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return 'require';
  }
  // Render internal database hosts use bare private-network DNS names (no dots,
  // e.g. `dpg-…-a`): the traffic never leaves Render's private network and the
  // internal endpoint is not a TLS-verifiable name, so plaintext is the correct
  // posture there — exactly how the service connected before TLS enforcement.
  if (!host.includes('.')) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
  return 'require';
}