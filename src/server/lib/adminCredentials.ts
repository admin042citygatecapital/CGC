/**
 * Secure admin credentials store — Cloudflare Workers version.
 *
 * The password hash is loaded from the ADMIN_PASSWORD_HASH Worker secret.
 * Hashes are resolved at request time via env — never at module-load time.
 *
 * To rotate the password:
 *   1. Generate a PBKDF2 hash using the hashPassword() function below
 *   2. Save as ADMIN_PASSWORD_HASH via: npx wrangler secret put ADMIN_PASSWORD_HASH
 */

import { getSecret } from '#airo/secrets';

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

/** Resolve hash from env secrets at request time (V2 takes precedence). */
function resolveHash(): string {
  const v2 = String(getSecret('ADMIN_PASSWORD_HASH_V2') ?? process.env.ADMIN_PASSWORD_HASH_V2 ?? '');
  if (v2 && v2.startsWith('100000:')) return v2;
  const primary = String(getSecret('ADMIN_PASSWORD_HASH') ?? process.env.ADMIN_PASSWORD_HASH ?? '');
  if (primary && primary.startsWith('100000:')) return primary;
  return '';
}

export function getAdminUsers(): AdminRecord[] {
  const secretHash = resolveHash();
  return ADMIN_STATIC.map(u => ({
    ...u,
    passwordHash: secretHash,
  }));
}

export function findAdminByEmail(email: string): AdminRecord | undefined {
  return getAdminUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
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
