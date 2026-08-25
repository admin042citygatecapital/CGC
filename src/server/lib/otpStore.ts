/**
 * Administrator email OTP challenges.
 *
 * Production challenges are persisted in PostgreSQL so a restart or second
 * application instance cannot bypass single-use, attempt, expiry, or resend
 * controls. Only cryptographic digests of the challenge identifier, OTP, IP,
 * and user agent are stored. A process-local store remains for database-free
 * local development and isolated tests.
 */
import crypto from 'node:crypto';
import { getQueryClient, isDatabaseConfigured } from '../db/db.js';

const parsedTtlSeconds = Number.parseInt(process.env.OTP_TTL_SECONDS ?? '60', 10);
const OTP_TTL_MS = (Number.isInteger(parsedTtlSeconds) && parsedTtlSeconds >= 30 && parsedTtlSeconds <= 600
  ? parsedTtlSeconds
  : 60) * 1_000;
const MAX_ATTEMPTS = 5;
const RATE_WINDOW_MS = 10 * 60_000;
const MAX_OTP_PER_WINDOW = 3;

interface OtpChallenge {
  adminId: string;
  email: string;
  credentialVersion: number;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  used: boolean;
  ipHash: string;
  uaHash: string;
  createdAt: number;
}

export interface AdminOtpPrincipal {
  adminId: string;
  email: string;
  credentialVersion: number;
}

interface RateEntry {
  count: number;
  windowStart: number;
}

const challenges = new Map<string, OtpChallenge>();
const rateStore = new Map<string, RateEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [id, challenge] of challenges) {
    if (challenge.expiresAt < now || challenge.used) challenges.delete(id);
  }
  for (const [key, rate] of rateStore) {
    if (rate.windowStart + RATE_WINDOW_MS < now) rateStore.delete(key);
  }
}, 2 * 60_000).unref();

function digest(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isolatedE2eMode(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.E2E_TEST_MODE === '1';
}

function makeOtp(): string {
  const configured = isolatedE2eMode() ? process.env.E2E_ADMIN_OTP : undefined;
  return /^\d{6}$/.test(configured ?? '')
    ? configured!
    : String(crypto.randomInt(100000, 1_000_000));
}

export interface OtpIssueResult {
  ok: boolean;
  challengeId?: string;
  otp?: string;
  error?: string;
  rateLimited?: boolean;
}

async function issuePersistentOtp(principal: AdminOtpPrincipal, ip: string, ua: string): Promise<OtpIssueResult> {
  const sql = getQueryClient();
  const normalizedEmail = normalizeEmail(principal.email);
  const now = new Date();
  const rateWindowStart = new Date(now.getTime() - RATE_WINDOW_MS);
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
  const otp = makeOtp();
  const challengeId = crypto.randomBytes(32).toString('base64url');
  const challengeIdHash = digest(challengeId);

  const outcome = await sql.begin(async (tx) => {
    // Password rotation and challenge issuance share this principal lock. A
    // request that authenticated an older password cannot publish an OTP
    // after the credential revision advances.
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`admin-credential:${principal.adminId}`}))`;
    const [current] = await tx<{ email: string; credential_version: number; is_active: boolean }[]>`
      SELECT email, credential_version, is_active
      FROM admins
      WHERE id = ${principal.adminId}
    `;
    if (!current?.is_active || normalizeEmail(current.email) !== normalizedEmail ||
        current.credential_version !== principal.credentialVersion) {
      return { staleCredential: true, rateLimited: false } as const;
    }
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`admin-otp:${digest(normalizedEmail)}`}))`;
    await tx`DELETE FROM admin_otp_challenges WHERE created_at < ${rateWindowStart}`;

    const [rate] = await tx<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM admin_otp_challenges
      WHERE email = ${normalizedEmail} AND created_at >= ${rateWindowStart}
    `;
    if (!isolatedE2eMode() && Number(rate?.count ?? 0) >= MAX_OTP_PER_WINDOW) {
      return { rateLimited: true } as const;
    }

    await tx`
      UPDATE admin_otp_challenges
      SET used = TRUE, invalidated_at = NOW()
      WHERE email = ${normalizedEmail} AND used = FALSE
    `;
    await tx`
      INSERT INTO admin_otp_challenges (
        challenge_id_hash, admin_id, email, credential_version, otp_hash, ip_hash, ua_hash,
        expires_at, attempts, used, created_at
      ) VALUES (
        ${challengeIdHash}, ${principal.adminId}, ${normalizedEmail}, ${principal.credentialVersion},
        ${digest(otp)}, ${digest(ip)}, ${digest(ua)},
        ${expiresAt}, 0, FALSE, ${now}
      )
    `;
    return { rateLimited: false } as const;
  });

  if ('staleCredential' in outcome && outcome.staleCredential) {
    return { ok: false, error: 'Administrator credentials changed. Please log in again.' };
  }

  if (outcome.rateLimited) {
    return { ok: false, rateLimited: true, error: 'Too many verification-code requests. Please wait 10 minutes.' };
  }
  return { ok: true, challengeId, otp };
}

function issueMemoryOtp(principal: AdminOtpPrincipal, ip: string, ua: string): OtpIssueResult {
  const now = Date.now();
  const normalizedEmail = normalizeEmail(principal.email);
  const rateKey = `otp:${normalizedEmail}`;
  let rate = rateStore.get(rateKey);
  if (!rate || rate.windowStart + RATE_WINDOW_MS < now) rate = { count: 0, windowStart: now };
  rate.count += 1;
  rateStore.set(rateKey, rate);
  if (!isolatedE2eMode() && rate.count > MAX_OTP_PER_WINDOW) {
    return { ok: false, rateLimited: true, error: 'Too many verification-code requests. Please wait 10 minutes.' };
  }

  for (const [id, challenge] of challenges) {
    if (challenge.email === normalizedEmail && !challenge.used) challenges.delete(id);
  }

  const otp = makeOtp();
  const challengeId = crypto.randomBytes(32).toString('base64url');
  challenges.set(challengeId, {
    adminId: principal.adminId,
    email: normalizedEmail,
    credentialVersion: principal.credentialVersion,
    otpHash: digest(otp),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    used: false,
    ipHash: digest(ip),
    uaHash: digest(ua),
    createdAt: now,
  });
  return { ok: true, challengeId, otp };
}

/** Return a plaintext OTP once to the email-delivery boundary. */
export async function issueOtp(principal: AdminOtpPrincipal, ip: string, ua: string): Promise<OtpIssueResult> {
  return isDatabaseConfigured()
    ? issuePersistentOtp(principal, ip, ua)
    : issueMemoryOtp(principal, ip, ua);
}

export interface OtpVerifyResult {
  ok: boolean;
  adminId?: string;
  email?: string;
  credentialVersion?: number;
  error?: string;
  locked?: boolean;
  expired?: boolean;
}

async function verifyPersistentOtp(
  challengeId: string,
  otp: string,
  fingerprint?: { ip: string; ua: string },
): Promise<OtpVerifyResult> {
  const sql = getQueryClient();
  const challengeHash = digest(challengeId);
  const inputHash = digest(otp.trim());

  return sql.begin(async (tx) => {
    const [identity] = await tx<{ admin_id: string }[]>`
      SELECT admin_id
      FROM admin_otp_challenges
      WHERE challenge_id_hash = ${challengeHash}
    `;
    if (!identity) {
      return { ok: false, error: 'Invalid or expired verification session. Please log in again.' };
    }
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`admin-credential:${identity.admin_id}`}))`;
    const [challenge] = await tx<{
      admin_id: string;
      email: string;
      credential_version: number;
      current_credential_version: number;
      is_active: boolean;
      otp_hash: string;
      ip_hash: string;
      ua_hash: string;
      expires_at: Date;
      attempts: number;
      used: boolean;
    }[]>`
      SELECT c.admin_id, c.email, c.credential_version,
             a.credential_version AS current_credential_version, a.is_active,
             c.otp_hash, c.ip_hash, c.ua_hash, c.expires_at, c.attempts, c.used
      FROM admin_otp_challenges c
      JOIN admins a ON a.id = c.admin_id
      WHERE c.challenge_id_hash = ${challengeHash}
      FOR UPDATE OF c
    `;
    if (!challenge || challenge.used) {
      return { ok: false, error: 'Invalid or expired verification session. Please log in again.' };
    }
    if (!challenge.is_active || challenge.credential_version !== challenge.current_credential_version) {
      await tx`
        UPDATE admin_otp_challenges
        SET used = TRUE, invalidated_at = NOW()
        WHERE challenge_id_hash = ${challengeHash}
      `;
      return { ok: false, locked: true, error: 'Administrator credentials changed. Please log in again.' };
    }
    if (fingerprint && (
      !safeEqual(challenge.ip_hash, digest(fingerprint.ip)) ||
      !safeEqual(challenge.ua_hash, digest(fingerprint.ua))
    )) {
      await tx`
        UPDATE admin_otp_challenges
        SET used = TRUE, invalidated_at = NOW()
        WHERE challenge_id_hash = ${challengeHash}
      `;
      return { ok: false, locked: true, error: 'The verification session is not valid for this device.' };
    }
    if (Date.now() > new Date(challenge.expires_at).getTime()) {
      await tx`
        UPDATE admin_otp_challenges
        SET used = TRUE, invalidated_at = NOW()
        WHERE challenge_id_hash = ${challengeHash}
      `;
      return { ok: false, expired: true, error: 'Verification code expired. Please request a new one.' };
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      await tx`
        UPDATE admin_otp_challenges
        SET used = TRUE, invalidated_at = NOW()
        WHERE challenge_id_hash = ${challengeHash}
      `;
      return { ok: false, locked: true, error: 'Too many failed attempts. Please log in again.' };
    }
    if (!safeEqual(inputHash, challenge.otp_hash)) {
      const attempts = challenge.attempts + 1;
      const locked = attempts >= MAX_ATTEMPTS;
      await tx`
        UPDATE admin_otp_challenges
        SET attempts = ${attempts}, used = ${locked},
            invalidated_at = CASE WHEN ${locked} THEN NOW() ELSE invalidated_at END
        WHERE challenge_id_hash = ${challengeHash}
      `;
      const remaining = MAX_ATTEMPTS - attempts;
      return locked
        ? { ok: false, locked: true, error: 'Too many failed attempts. Please log in again.' }
        : { ok: false, error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` };
    }

    await tx`
      UPDATE admin_otp_challenges
      SET used = TRUE, verified_at = NOW()
      WHERE challenge_id_hash = ${challengeHash}
    `;
    return {
      ok: true,
      adminId: challenge.admin_id,
      email: challenge.email,
      credentialVersion: challenge.credential_version,
    };
  });
}

function verifyMemoryOtp(
  challengeId: string,
  otp: string,
  fingerprint?: { ip: string; ua: string },
): OtpVerifyResult {
  const challenge = challenges.get(challengeId);
  if (!challenge || challenge.used) {
    return { ok: false, error: 'Invalid or expired verification session. Please log in again.' };
  }
  if (fingerprint && (
    !safeEqual(challenge.ipHash, digest(fingerprint.ip)) ||
    !safeEqual(challenge.uaHash, digest(fingerprint.ua))
  )) {
    challenges.delete(challengeId);
    return { ok: false, locked: true, error: 'The verification session is not valid for this device.' };
  }
  if (Date.now() > challenge.expiresAt) {
    challenges.delete(challengeId);
    return { ok: false, expired: true, error: 'Verification code expired. Please request a new one.' };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    challenges.delete(challengeId);
    return { ok: false, locked: true, error: 'Too many failed attempts. Please log in again.' };
  }
  if (!safeEqual(digest(otp.trim()), challenge.otpHash)) {
    challenge.attempts += 1;
    const remaining = MAX_ATTEMPTS - challenge.attempts;
    if (remaining <= 0) {
      challenges.delete(challengeId);
      return { ok: false, locked: true, error: 'Too many failed attempts. Please log in again.' };
    }
    return { ok: false, error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` };
  }
  challenges.delete(challengeId);
  return {
    ok: true,
    adminId: challenge.adminId,
    email: challenge.email,
    credentialVersion: challenge.credentialVersion,
  };
}

export async function verifyOtp(
  challengeId: string,
  otp: string,
  fingerprint?: { ip: string; ua: string },
): Promise<OtpVerifyResult> {
  return isDatabaseConfigured()
    ? verifyPersistentOtp(challengeId, otp, fingerprint)
    : verifyMemoryOtp(challengeId, otp, fingerprint);
}

export async function getChallengeEmail(challengeId: string): Promise<string | null> {
  if (!isDatabaseConfigured()) return challenges.get(challengeId)?.email ?? null;
  const [challenge] = await getQueryClient()<{ email: string }[]>`
    SELECT c.email
    FROM admin_otp_challenges c
    JOIN admins a ON a.id = c.admin_id
    WHERE c.challenge_id_hash = ${digest(challengeId)}
      AND c.used = FALSE
      AND a.is_active = TRUE
      AND c.credential_version = a.credential_version
    LIMIT 1
  `;
  return challenge?.email ?? null;
}

export async function getOtpTtlRemaining(challengeId: string): Promise<number> {
  if (!isDatabaseConfigured()) {
    const challenge = challenges.get(challengeId);
    return challenge ? Math.max(0, Math.ceil((challenge.expiresAt - Date.now()) / 1_000)) : 0;
  }
  const [challenge] = await getQueryClient()<{ expires_at: Date }[]>`
    SELECT expires_at FROM admin_otp_challenges
    WHERE challenge_id_hash = ${digest(challengeId)} AND used = FALSE
    LIMIT 1
  `;
  return challenge
    ? Math.max(0, Math.ceil((new Date(challenge.expires_at).getTime() - Date.now()) / 1_000))
    : 0;
}

export interface OtpChallengeValidationResult extends OtpVerifyResult {
  adminId?: string;
  email?: string;
  credentialVersion?: number;
}

export async function validateOtpChallenge(
  challengeId: string,
  fingerprint: { ip: string; ua: string },
  options: { allowExpired?: boolean } = {},
): Promise<OtpChallengeValidationResult> {
  if (!isDatabaseConfigured()) {
    const challenge = challenges.get(challengeId);
    if (!challenge || challenge.used) {
      return { ok: false, error: 'Invalid or expired verification session. Please log in again.' };
    }
    if (!safeEqual(challenge.ipHash, digest(fingerprint.ip)) || !safeEqual(challenge.uaHash, digest(fingerprint.ua))) {
      challenges.delete(challengeId);
      return { ok: false, locked: true, error: 'The verification session is not valid for this device.' };
    }
    if (Date.now() > challenge.expiresAt) {
      if (options.allowExpired) return {
        ok: true, expired: true, adminId: challenge.adminId,
        email: challenge.email, credentialVersion: challenge.credentialVersion,
      };
      challenges.delete(challengeId);
      return { ok: false, expired: true, error: 'Verification code expired. Please log in again.' };
    }
    return {
      ok: true, adminId: challenge.adminId,
      email: challenge.email, credentialVersion: challenge.credentialVersion,
    };
  }

  const sql = getQueryClient();
  const challengeHash = digest(challengeId);
  return sql.begin(async (tx) => {
    const [identity] = await tx<{ admin_id: string }[]>`
      SELECT admin_id FROM admin_otp_challenges WHERE challenge_id_hash = ${challengeHash}
    `;
    if (!identity) {
      return { ok: false, error: 'Invalid or expired verification session. Please log in again.' };
    }
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`admin-credential:${identity.admin_id}`}))`;
    const [challenge] = await tx<{
      admin_id: string;
      email: string;
      credential_version: number;
      current_credential_version: number;
      is_active: boolean;
      ip_hash: string;
      ua_hash: string;
      expires_at: Date;
      used: boolean;
    }[]>`
      SELECT c.admin_id, c.email, c.credential_version,
             a.credential_version AS current_credential_version, a.is_active,
             c.ip_hash, c.ua_hash, c.expires_at, c.used
      FROM admin_otp_challenges c
      JOIN admins a ON a.id = c.admin_id
      WHERE c.challenge_id_hash = ${challengeHash}
      FOR UPDATE OF c
    `;
    if (!challenge || challenge.used) {
      return { ok: false, error: 'Invalid or expired verification session. Please log in again.' };
    }
    if (!challenge.is_active || challenge.credential_version !== challenge.current_credential_version) {
      await tx`
        UPDATE admin_otp_challenges
        SET used = TRUE, invalidated_at = NOW()
        WHERE challenge_id_hash = ${challengeHash}
      `;
      return { ok: false, locked: true, error: 'Administrator credentials changed. Please log in again.' };
    }
    if (!safeEqual(challenge.ip_hash, digest(fingerprint.ip)) || !safeEqual(challenge.ua_hash, digest(fingerprint.ua))) {
      await tx`
        UPDATE admin_otp_challenges
        SET used = TRUE, invalidated_at = NOW()
        WHERE challenge_id_hash = ${challengeHash}
      `;
      return { ok: false, locked: true, error: 'The verification session is not valid for this device.' };
    }
    if (Date.now() > new Date(challenge.expires_at).getTime()) {
      if (options.allowExpired) return {
        ok: true, expired: true, adminId: challenge.admin_id,
        email: challenge.email, credentialVersion: challenge.credential_version,
      };
      await tx`
        UPDATE admin_otp_challenges
        SET used = TRUE, invalidated_at = NOW()
        WHERE challenge_id_hash = ${challengeHash}
      `;
      return { ok: false, expired: true, error: 'Verification code expired. Please log in again.' };
    }
    return {
      ok: true, adminId: challenge.admin_id,
      email: challenge.email, credentialVersion: challenge.credential_version,
    };
  });
}

export async function discardOtpChallenge(challengeId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return challenges.delete(challengeId);
  const rows = await getQueryClient()<Array<{ challenge_id_hash: string }>>`
    UPDATE admin_otp_challenges
    SET used = TRUE, invalidated_at = NOW()
    WHERE challenge_id_hash = ${digest(challengeId)} AND used = FALSE
    RETURNING challenge_id_hash
  `;
  return rows.length > 0;
}
