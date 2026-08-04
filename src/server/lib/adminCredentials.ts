/**
 * Secure admin credentials store.
 *
 * FIX (production remediation, see AUDIT_REPORT.md §7/§13-B): this file was
 * originally written for a Cloudflare Workers request-scoped `env` binding
 * (`env.ADMIN_PASSWORD_HASH`) — that `Env` type was never actually defined
 * anywhere in this codebase, and none of this file's 5 call sites passed the
 * required second argument, so every one of them was a compile error before
 * this fix (in addition to the app running as a standard Express/Node
 * process, not a Worker, so there is no per-request `env` binding to pass in
 * the first place). Resolution now goes through the same `getSecret()`
 * convention every other secret access in this codebase already uses
 * (see #airo/secrets), reading from process.env — consistent with
 * envConfig.ts's stated rule that secrets are never read from
 * process.env directly at call sites.
 *
 * The password hash is loaded from the ADMIN_PASSWORD_HASH secret.
 * Hashes are resolved at request time — never cached at module-load time.
 *
 * To rotate the password:
 *   1. Generate a PBKDF2 hash using the hashPassword() function below
 *   2. Set ADMIN_PASSWORD_HASH (and/or ADMIN_PASSWORD_HASH_V2) in your
 *      environment/secrets manager.
 */
import { getSecret } from '#airo/secrets';
import { getConfig } from './configDb.js';

const PASSWORD_OVERRIDE_KEY = 'admin_password_hash_override';

export interface AdminRecord {
  id:           string;
  email:        string;
  name:         string;
  role:         string;
  avatar:       string;
  passwordHash: string;
}

const ADMIN_STATIC: Omit<AdminRecord, 'passwordHash'>[] = [
  {
    id:     'admin_001',
    email:  'admin@citygate.capital',
    name:   'Super Admin',
    role:   'superadmin',
    avatar: 'SA',
  },
];

/**
 * Resolve hash at request time. A password-reset-confirmed override
 * (persisted via setAdminPasswordOverride, in the same `config` table
 * adminResetTokenStore.ts already uses) takes precedence over the
 * env-configured hash, so a completed reset actually changes what login
 * checks — env vars alone can't be rewritten by a running process.
 */
async function resolveHash(): Promise<string> {
  const override = await getConfig<string>(PASSWORD_OVERRIDE_KEY);
  if (override && override.startsWith('100000:')) return override;
  const v2 = getSecret('ADMIN_PASSWORD_HASH_V2');
  if (v2 && v2.startsWith('100000:')) return v2;
  const primary = getSecret('ADMIN_PASSWORD_HASH');
  if (primary && primary.startsWith('100000:')) return primary;
  return '';
}

export async function getAdminUsers(): Promise<AdminRecord[]> {
  const secretHash = await resolveHash();
  return ADMIN_STATIC.map(u => ({
    ...u,
    passwordHash: secretHash,
  }));
}

export async function findAdminByEmail(email: string): Promise<AdminRecord | undefined> {
  const users = await getAdminUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

/** Persist a new admin password hash (called after a completed password-reset). */
export async function setAdminPasswordOverride(hash: string): Promise<void> {
  const { setConfig } = await import('./configDb.js');
  await setConfig(PASSWORD_OVERRIDE_KEY, hash, 'system');
}

// ─── PBKDF2 via Web Crypto API (replaces bcryptjs) ───

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return `100000:${saltB64}:${hashB64}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  const [iterStr, saltB64, hashB64] = stored.split(':');
  if (!iterStr || !saltB64 || !hashB64) return false;

  const iterations = parseInt(iterStr);
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(plain), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return btoa(String.fromCharCode(...new Uint8Array(hash))) === hashB64;
}
