/**
 * passwordHash.ts — Workers-compatible password hashing
 * ───────────────────────────────────────────────────────
 * Uses Argon2id via @node-rs/argon2 which ships a WASM fallback
 * that runs in Cloudflare Workers (no native .node binding needed).
 *
 * Parameters (OWASP recommended minimums for Argon2id):
 *   memoryCost: 65536 (64 MiB)
 *   timeCost:   3 iterations
 *   parallelism: 1
 *
 * Transparent bcrypt upgrade shim:
 *   If a stored hash starts with "$2a$" or "$2b$" (bcrypt), we verify
 *   with bcryptjs and — on success — re-hash with Argon2id and return
 *   the new hash so the caller can persist it. No forced password resets.
 */

import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';

// @node-rs/argon2 declares Algorithm as an ambient `const enum`, which can't
// be referenced under isolatedModules (each file is transpiled independently,
// so the compiler can't inline a const enum's values from another module).
// 2 = Algorithm.Argon2id.
const ARGON2_OPTIONS = {
  algorithm:    2,
  memoryCost:   65536,  // 64 MiB
  timeCost:     3,
  parallelism:  1,
};

/**
 * Hash a plaintext password with Argon2id.
 * Returns the encoded hash string (includes salt, params, algorithm).
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2Hash(plain, ARGON2_OPTIONS);
}

export interface VerifyResult {
  /** Whether the password matched the stored hash */
  ok: boolean;
  /**
   * If the stored hash was bcrypt and the password matched, this contains
   * the new Argon2id hash. The caller MUST persist it to complete the upgrade.
   * Undefined when the stored hash is already Argon2id.
   */
  rehash?: string;
}

/**
 * Verify a plaintext password against a stored hash.
 *
 * Handles both Argon2id hashes (primary) and legacy bcrypt hashes
 * (transparent upgrade path — no user-facing change required).
 */
export async function verifyPassword(plain: string, stored: string): Promise<VerifyResult> {
  if (!stored) return { ok: false };

  // ── Argon2id path (primary) ───────────────────────────────────────────────
  if (stored.startsWith('$argon2')) {
    const ok = await argon2Verify(stored, plain);
    return { ok };
  }

  // ── Legacy bcrypt path (transparent upgrade) ──────────────────────────────
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    // Dynamic import keeps bcryptjs out of the Workers bundle once all hashes
    // have been upgraded. The import() is cached by the module system so there
    // is no repeated overhead on subsequent calls within the same process.
    const bcrypt = await import('bcryptjs');
    const ok = await bcrypt.compare(plain, stored);
    if (!ok) return { ok: false };

    // Password matched — generate a new Argon2id hash for the caller to persist
    const rehash = await hashPassword(plain);
    return { ok: true, rehash };
  }

  // ── PBKDF2 path (adminCredentials.ts legacy format: "100000:salt:hash") ───
  if (stored.includes(':') && !stored.startsWith('$')) {
    const [iterStr, saltB64, hashB64] = stored.split(':');
    if (!iterStr || !saltB64 || !hashB64) return { ok: false };
    const iterations = parseInt(iterStr, 10);
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    const enc  = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(plain), 'PBKDF2', false, ['deriveBits']
    );
    const hash = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial, 256
    );
    const ok = btoa(String.fromCharCode(...new Uint8Array(hash))) === hashB64;
    if (!ok) return { ok: false };
    const rehash = await hashPassword(plain);
    return { ok: true, rehash };
  }

  return { ok: false };
}
