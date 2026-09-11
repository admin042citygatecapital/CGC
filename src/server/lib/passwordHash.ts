/**
 * passwordHash.ts — Pure-WASM password hashing (Vercel / Node / Alpine compatible)
 * ──────────────────────────────────────────────────────────────────────────────
 * Uses Argon2id via hash-wasm — a pure-WASM library that bundles cleanly
 * with Vite/Rollup and runs in any environment (Node, Vercel serverless,
 * Alpine containers) without native .node bindings.
 *
 * Parameters (OWASP recommended minimums for Argon2id):
 *   parallelism: 1
 *   iterations:  3
 *   memorySize:  65536 (64 MiB)
 *
 * Transparent bcrypt upgrade shim:
 *   If a stored hash starts with "$2a$" or "$2b$" (bcrypt), we verify
 *   with bcryptjs and — on success — re-hash with Argon2id and return
 *   the new hash so the caller can persist it. No forced password resets.
 */

import { timingSafeEqual } from 'node:crypto';
import { argon2id, argon2Verify } from 'hash-wasm';

const ARGON2_PARAMS = {
  parallelism: 1,
  iterations:  3,
  memorySize:  65536,  // 64 MiB
  hashLength:  32,
  outputType:  'encoded' as const,
};

/**
 * Hash a plaintext password with Argon2id.
 * Returns the encoded hash string (includes salt, params, algorithm).
 */
export async function hashPassword(plain: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  return argon2id({
    password: plain,
    salt:     saltBytes,
    ...ARGON2_PARAMS,
  });
}

export interface VerifyResult {
  /** Whether the password matched the stored hash */
  ok: boolean;
  /**
   * If the stored hash was bcrypt/PBKDF2 and the password matched, this
   * contains the new Argon2id hash. The caller MUST persist it to complete
   * the upgrade. Undefined when the stored hash is already Argon2id.
   */
  rehash?: string;
}

/**
 * Verify a plaintext password against a stored hash.
 *
 * Handles Argon2id hashes (primary), legacy bcrypt hashes, and legacy
 * PBKDF2 hashes (adminCredentials.ts format: "100000:salt:hash").
 */
export async function verifyPassword(plain: string, stored: string): Promise<VerifyResult> {
  if (!stored) return { ok: false };

  // ── Argon2id path (primary) ───────────────────────────────────────────────
  if (stored.startsWith('$argon2')) {
    try {
      const ok = await argon2Verify({ password: plain, hash: stored });
      return { ok };
    } catch {
      return { ok: false };
    }
  }

  // ── Legacy bcrypt path (transparent upgrade) ──────────────────────────────
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    try {
      const bcrypt = await import('bcryptjs');
      const ok = await bcrypt.compare(plain, stored);
      if (!ok) return { ok: false };
      const rehash = await hashPassword(plain);
      return { ok: true, rehash };
    } catch {
      return { ok: false };
    }
  }

  // ── PBKDF2 path (adminCredentials.ts legacy format: "100000:salt:hash") ───
  if (stored.includes(':') && !stored.startsWith('$')) {
    try {
      const [iterStr, saltB64, hashB64] = stored.split(':');
      if (!iterStr || !saltB64 || !hashB64) return { ok: false };
      const iterations = parseInt(iterStr, 10);
      if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) {
        return { ok: false };
      }
      const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
      const enc  = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(plain), 'PBKDF2', false, ['deriveBits']
      );
      const derived = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        keyMaterial, 256
      );
      // Constant-time comparison — the legacy hash length is public, so the
      // derived bytes are padded to the stored length before comparing.
      const derivedBytes = new Uint8Array(derived);
      const storedBytes = Uint8Array.from(atob(hashB64), c => c.charCodeAt(0));
      const ok = derivedBytes.length === storedBytes.length &&
        timingSafeEqual(Buffer.from(derivedBytes), Buffer.from(storedBytes));
      if (!ok) return { ok: false };
      const rehash = await hashPassword(plain);
      return { ok: true, rehash };
    } catch {
      return { ok: false };
    }
  }

  return { ok: false };
}
