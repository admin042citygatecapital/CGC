/**
 * OTP Store — server-side email OTP for admin 2FA.
 *
 * Security properties:
 *  - 6-digit cryptographically random OTP (not Math.random)
 *  - 60-second expiry (configurable via OTP_TTL_SECONDS env)
 *  - Single-use: consumed on first successful verify
 *  - Max 5 failed attempts per challenge before lockout
 *  - Per-email rate limit: max 3 OTP requests per 10 min (prevents spam)
 *  - Stored in memory only — no disk persistence (OTPs are ephemeral)
 *  - Challenge ID is a 128-bit random token (prevents enumeration)
 *  - Constant-time comparison to prevent timing attacks
 */
import crypto from 'node:crypto';

const OTP_TTL_MS       = (parseInt(process.env.OTP_TTL_SECONDS ?? '60', 10)) * 1_000;
const MAX_ATTEMPTS     = 5;
const RATE_WINDOW_MS   = 10 * 60_000; // 10 minutes
const MAX_OTP_PER_WINDOW = 3;

interface OtpChallenge {
  email:      string;
  otpHash:    string;   // SHA-256 of the OTP — never store plaintext
  expiresAt:  number;   // unix ms
  attempts:   number;
  used:       boolean;
  ip:         string;
  ua:         string;
  createdAt:  number;
}

interface RateEntry {
  count:   number;
  windowStart: number;
}

// In-memory stores — OTPs are ephemeral, no disk persistence needed
const challenges = new Map<string, OtpChallenge>();
const rateStore  = new Map<string, RateEntry>();

// Prune expired challenges every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, c] of challenges) {
    if (c.expiresAt < now || c.used) challenges.delete(id);
  }
  for (const [k, r] of rateStore) {
    if (r.windowStart + RATE_WINDOW_MS < now) rateStore.delete(k);
  }
}, 2 * 60_000).unref();

/** Hash an OTP with SHA-256 so we never store the plaintext */
function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/** Constant-time string comparison to prevent timing attacks */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface OtpIssueResult {
  ok:        boolean;
  challengeId?: string;
  otp?:      string;   // returned to caller so they can email it
  error?:    string;
  rateLimited?: boolean;
}

/**
 * Issue a new OTP challenge for the given email.
 * Returns the plaintext OTP once — caller must email it immediately.
 */
export function issueOtp(email: string, ip: string, ua: string): OtpIssueResult {
  const now = Date.now();

  // Per-email rate limit
  const rateKey = `otp:${email.toLowerCase()}`;
  let rate = rateStore.get(rateKey);
  if (!rate || rate.windowStart + RATE_WINDOW_MS < now) {
    rate = { count: 0, windowStart: now };
  }
  rate.count += 1;
  rateStore.set(rateKey, rate);

  if (rate.count > MAX_OTP_PER_WINDOW) {
    return { ok: false, rateLimited: true, error: 'Too many OTP requests. Please wait 10 minutes.' };
  }

  // Invalidate any existing unused challenge for this email
  for (const [id, c] of challenges) {
    if (c.email === email && !c.used) challenges.delete(id);
  }

  // Generate 6-digit OTP using crypto (not Math.random)
  const otp = String(crypto.randomInt(100000, 999999));
  const challengeId = crypto.randomBytes(16).toString('hex');

  challenges.set(challengeId, {
    email,
    otpHash:   hashOtp(otp),
    expiresAt: now + OTP_TTL_MS,
    attempts:  0,
    used:      false,
    ip,
    ua,
    createdAt: now,
  });

  return { ok: true, challengeId, otp };
}

export interface OtpVerifyResult {
  ok:      boolean;
  error?:  string;
  locked?: boolean;
  expired?: boolean;
}

/**
 * Verify an OTP against a challenge.
 * Consumes the challenge on success (single-use).
 */
export function verifyOtp(challengeId: string, otp: string): OtpVerifyResult {
  const challenge = challenges.get(challengeId);

  if (!challenge) {
    return { ok: false, error: 'Invalid or expired verification session. Please log in again.' };
  }

  if (challenge.used) {
    return { ok: false, error: 'This verification code has already been used.' };
  }

  if (Date.now() > challenge.expiresAt) {
    challenges.delete(challengeId);
    return { ok: false, expired: true, error: 'Verification code expired. Please request a new one.' };
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    challenges.delete(challengeId);
    return { ok: false, locked: true, error: 'Too many failed attempts. Please log in again.' };
  }

  const inputHash = hashOtp(otp.trim());
  if (!safeEqual(inputHash, challenge.otpHash)) {
    challenge.attempts += 1;
    const remaining = MAX_ATTEMPTS - challenge.attempts;
    if (remaining <= 0) {
      challenges.delete(challengeId);
      return { ok: false, locked: true, error: 'Too many failed attempts. Please log in again.' };
    }
    return { ok: false, error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` };
  }

  // Mark as used — single-use enforcement
  challenge.used = true;
  challenges.delete(challengeId);
  return { ok: true };
}

/** Get the email associated with a challenge (for session creation after verify) */
export function getChallengeEmail(challengeId: string): string | null {
  return challenges.get(challengeId)?.email ?? null;
}

/** Seconds remaining before a challenge expires (for UI countdown) */
export function getOtpTtlRemaining(challengeId: string): number {
  const c = challenges.get(challengeId);
  if (!c) return 0;
  return Math.max(0, Math.ceil((c.expiresAt - Date.now()) / 1000));
}
