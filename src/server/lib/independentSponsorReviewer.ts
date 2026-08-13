import crypto from 'node:crypto';
import type { Request } from 'express';
import { getSecret } from '#runtime/secrets';
import type { SponsorActor } from './sponsorReadinessStore.js';

const SHA256_HEX = /^[a-f0-9]{64}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class IndependentReviewerAuthenticationError extends Error {
  readonly code = 'REVIEWER_AUTH_FAILED';
  readonly status = 403;
}

function safeEqualHex(left: string, right: string): boolean {
  if (!SHA256_HEX.test(left) || !SHA256_HEX.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

/**
 * Authenticate the isolated sponsor checker without creating an admin session.
 * Only a hash is kept in the environment; the raw credential stays with the
 * reviewer and is accepted in a header so it never appears in a URL or cookie.
 */
export function authenticateIndependentSponsorReviewer(req: Request): SponsorActor {
  const configuredHash = String(getSecret('SPONSOR_REVIEWER_KEY_HASH') ?? '').trim().toLowerCase();
  const reviewerEmail = String(getSecret('SPONSOR_REVIEWER_EMAIL') ?? '').trim().toLowerCase();
  const adminEmail = String(getSecret('ADMIN_EMAIL') ?? 'admin@citygate.capital').trim().toLowerCase();
  const rawHeader = req.headers['x-sponsor-reviewer-key'];
  const providedKey = Array.isArray(rawHeader) ? '' : String(rawHeader ?? '');
  const providedHash = providedKey.length >= 32 && providedKey.length <= 512
    ? crypto.createHash('sha256').update(providedKey).digest('hex')
    : '';

  // Use the same response for absent configuration, invalid identity and bad
  // credentials. This avoids turning the endpoint into a configuration oracle.
  if (
    !SHA256_HEX.test(configuredHash)
    || !EMAIL.test(reviewerEmail)
    || reviewerEmail === adminEmail
    || providedKey.length < 32
    || !safeEqualHex(configuredHash, providedHash)
  ) {
    throw new IndependentReviewerAuthenticationError('Independent reviewer authentication failed.');
  }

  return {
    id: `external_checker_${crypto.createHash('sha256').update(reviewerEmail).digest('hex').slice(0, 16)}`,
    email: reviewerEmail,
    role: 'COMPLIANCE_ADMIN',
    ip: req.ip ?? 'unknown',
  };
}

export function isIndependentSponsorReviewer(actor: Pick<SponsorActor, 'id' | 'role'>): boolean {
  return actor.role === 'COMPLIANCE_ADMIN' && /^external_checker_[a-f0-9]{16}$/.test(actor.id);
}
