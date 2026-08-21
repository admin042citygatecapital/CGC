/**
 * POST /api/admin/auth/login
 *
 * Body: { email, password }
 *
 * Validates credentials, requires device-bound email OTP on untrusted devices,
 * and creates a session only after the second factor succeeds.
 * All other security systems remain active:
 *  - Brute-force lockout (per-email + per-IP, exponential backoff)
 *  - Secure Argon2id verification with legacy bcrypt/PBKDF2 compatibility
 *  - HttpOnly Secure session cookie
 *  - Full audit + login log on every outcome
 *  - Login alert email on success
 */
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { findAdminByEmail, verifyPassword } from '../../../../lib/adminCredentials.js';
import { permissionsForAdminRole } from '../../../../lib/adminAuthorizationMiddleware.js';
import { createSession } from '../../../../lib/sessionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { appendLoginEvent } from '../../../../lib/loginLog.js';
import { checkLockout, recordLoginFailure, recordLoginSuccess, getFailCount } from '../../../../lib/bruteForce.js';
import { COOKIE_NAME, sessionCookieOptions } from '../../../../lib/adminAuthMiddleware.js';
import { sendAdminLoginAlertEmail, sendAdminOtpEmail } from '../../../../lib/emailService.js';
import { issueOtp } from '../../../../lib/otpStore.js';
import { DEVICE_COOKIE, validateTrustedDevice } from '../../../../lib/trustedDeviceStore.js';

const SESSION_MAX_MS = (parseInt(process.env.SESSION_MAX_HOURS ?? '8', 10)) * 3_600_000;

export default async function handler(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };
  const ip = req.ip ?? 'unknown';
  const ua = req.headers['user-agent'] ?? 'unknown';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // ── Brute-force check ────────────────────────────────────────────────────
  const lockout = await checkLockout(email, ip);
  if (lockout.blocked) {
    appendAudit({ event: 'login_blocked', email, ip, reason: 'brute_force_lockout' });
    await appendLoginEvent({ actor: 'admin', email, result: 'account_locked', ip, ua, reason: 'brute_force_lockout' });
    return res.status(429).json({
      error: `Too many failed attempts. Try again in ${lockout.remainingMin} minute(s).`,
    });
  }

  // ── Credential verification ──────────────────────────────────────────────
  const admin = await findAdminByEmail(email);

  // Always run a password verification path to reduce timing-based user enumeration.
  const hashToCheck = admin?.passwordHash ?? '$2a$12$invalidhashpaddingtomakethiswork00000000000000000000000';
  const passwordOk  = await verifyPassword(password, hashToCheck);

  if (!admin || !passwordOk) {
    await recordLoginFailure(email, ip);
    const failCount = await getFailCount(email);
    const reason    = admin ? 'wrong_password' : 'user_not_found';
    appendAudit({ event: 'login_failed', email, ip, reason, meta: { failCount } });
    await appendLoginEvent({ actor: 'admin', email, result: 'failed', ip, ua, reason });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const trustedDeviceToken = (req.cookies as Record<string, string> | undefined)?.[DEVICE_COOKIE];
  const trustedDevice = trustedDeviceToken
    ? await validateTrustedDevice(trustedDeviceToken, admin.id)
    : null;

  if (!trustedDevice) {
    const challenge = issueOtp(admin.email, ip, ua);
    if (!challenge.ok || !challenge.challengeId || !challenge.otp) {
      appendAudit({ event: 'otp_issue_failed', adminId: admin.id, email, ip, reason: challenge.error });
      return res.status(challenge.rateLimited ? 429 : 503).json({
        error: challenge.error ?? 'Unable to create a verification challenge.',
      });
    }

    try {
      await sendAdminOtpEmail(admin.email, admin.name, challenge.otp, ip, ua);
    } catch {
      appendAudit({ event: 'otp_delivery_failed', adminId: admin.id, email, ip });
      return res.status(503).json({ error: 'Unable to deliver the verification code. Please try again.' });
    }

    appendAudit({ event: 'otp_issued', adminId: admin.id, email, ip });
    return res.status(202).json({
      ok: true,
      otpRequired: true,
      challengeId: challenge.challengeId,
      expiresInSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '60', 10),
    });
  }

  // ── Credentials valid — create session immediately ───────────────────────
  await recordLoginSuccess(email, ip);

  const sessionToken = crypto.randomBytes(32).toString('hex');
  await createSession(sessionToken, {
    adminId:   admin.id,
    email:     admin.email,
    role:      admin.role,
    createdAt: new Date().toISOString(),
    ip,
    ua,
  });

  appendAudit({ event: 'login_success', adminId: admin.id, email, ip });
  await appendLoginEvent({
    actor: 'admin', email: admin.email, userId: admin.id,
    result: 'success', ip, ua,
    sessionId: sessionToken.slice(0, 8),
  });

  // Fire-and-forget login alert email
  sendAdminLoginAlertEmail(admin.email, admin.name, ip, ua, trustedDevice.name, true).catch(() => {});

  // Set HttpOnly session cookie
  res.cookie(COOKIE_NAME, sessionToken, sessionCookieOptions(SESSION_MAX_MS));

  const permissions = await permissionsForAdminRole(admin.role);
  return res.json({
    ok:    true,
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role, avatar: admin.avatar, permissions },
  });
}
