import crypto from 'node:crypto';

const PERSISTED_DIGEST_PREFIX = 'sha256:';
const SHA256_HEX = /^[a-f0-9]{64}$/i;

/** Return the irreversible lookup digest for an opaque bearer credential. */
export function digestOpaqueToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Flat-file stores prefix digests so legacy raw 64-character bearer tokens can
 * be identified and revoked instead of being mistaken for a digest.
 */
export function persistedTokenKey(token: string): string {
  return `${PERSISTED_DIGEST_PREFIX}${digestOpaqueToken(token)}`;
}

export function digestFromPersistedTokenKey(value: string): string | null {
  if (!value.startsWith(PERSISTED_DIGEST_PREFIX)) return null;
  const digest = value.slice(PERSISTED_DIGEST_PREFIX.length);
  return SHA256_HEX.test(digest) ? digest.toLowerCase() : null;
}

export function persistedTokenKeyFromDigest(digest: string): string | null {
  return SHA256_HEX.test(digest)
    ? `${PERSISTED_DIGEST_PREFIX}${digest.toLowerCase()}`
    : null;
}

export function isSha256Digest(value: string): boolean {
  return SHA256_HEX.test(value);
}
