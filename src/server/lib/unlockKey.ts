/**
 * Constant-time comparison for break-glass unlock keys.
 *
 * Both sides are hashed before comparison so the comparison input length never
 * leaks the configured key length and timing cannot reveal matching prefixes.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

export function unlockKeyMatches(provided: string | undefined, configured: string | undefined): boolean {
  if (!provided || !configured) return false;
  const providedDigest = createHash('sha256').update(provided, 'utf8').digest();
  const configuredDigest = createHash('sha256').update(configured, 'utf8').digest();
  return timingSafeEqual(providedDigest, configuredDigest);
}