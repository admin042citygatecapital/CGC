import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../../server/lib/passwordHash';

/** Build a legacy adminCredential-format hash: "iterations:salt:hash" (base64). */
async function buildLegacyHash(password: string, iterations = 100_000): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial, 256,
  );
  const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
  return `${iterations}:${b64(salt)}:${b64(new Uint8Array(derived))}`;
}

describe('password hash verification', () => {
  it('round-trips Argon2id hashes', async () => {
    const stored = await hashPassword('Correct-Horse-1!');
    expect(stored.startsWith('$argon2')).toBe(true);
    expect((await verifyPassword('Correct-Horse-1!', stored)).ok).toBe(true);
    expect((await verifyPassword('wrong-password-1!', stored)).ok).toBe(false);
  });

  it('verifies legacy PBKDF2 hashes in bounded format and offers a rehash', async () => {
    const stored = await buildLegacyHash('Legacy-Password-1!');
    const result = await verifyPassword('Legacy-Password-1!', stored);
    expect(result.ok).toBe(true);
    expect(result.rehash).toMatch(/^\$argon2/);
  });

  it('rejects a wrong password against a legacy PBKDF2 hash', async () => {
    const stored = await buildLegacyHash('Legacy-Password-1!');
    expect((await verifyPassword('not-the-password', stored)).ok).toBe(false);
  });

  it('rejects legacy hashes outside the iteration bounds instead of doing the work', async () => {
    // Below the 100k floor: cheap configurations must never verify.
    const cheap = await buildLegacyHash('Legacy-Password-1!', 50_000);
    expect((await verifyPassword('Legacy-Password-1!', cheap)).ok).toBe(false);
    // Above the 2M ceiling: malformed trusted configuration stays bounded.
    const heavy = await buildLegacyHash('Legacy-Password-1!', 3_000_000);
    expect((await verifyPassword('Legacy-Password-1!', heavy)).ok).toBe(false);
  });

  it('compares derived bytes in constant time (source contract)', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('src/server/lib/passwordHash.ts', 'utf8');
    expect(source).toContain('timingSafeEqual(Buffer.from(derivedBytes), Buffer.from(storedBytes))');
    expect(source).not.toContain('=== hashB64');
  });
});