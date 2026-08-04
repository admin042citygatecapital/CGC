/**
 * POST /api/admin/auth/otp/verify
 *
 * Body: { challengeId, otp, rememberDevice? }
 *
 * Verifies the OTP issued by the login endpoint.
 * On success:
 *  - Creates a full session (HttpOnly cookie + Bearer token)
 *  - Optionally registers a trusted device (30-day cookie)
 *  - Sends a login alert email
 *
 * On failure:
 *  - Records brute-force attempt
 *  - Returns remaining attempts or lockout status
 */
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { verifyOtp, getChallengeEmail } from '../../../../../lib/otpStore.js';
import { findAdminByEmail } from '../../../../../lib/adminCredentials.js';
import { createSession } from '../../../../../lib/sessionStore.js';
import { appendAudit } from '../../../../../lib/auditLog.js';
import { appendLoginEvent } from '../../../../../lib/loginLog.js';
import { recordLoginFailure, recordLoginSuccess } from '../../../../../lib/bruteForce.js';
import { COOKIE_NAME, sessionCookieOptions } from '../../../../../lib/adminAuthMiddleware.js';
import { registerTrustedDevice, DEVICE_COOKIE } from '../../../../../lib/trustedDeviceStore.js';
import { sendAdminLoginAlertEmail } from '../../../../../lib/emailService.js';

const SESSION_MAX_MS = (parseInt(process.env.SESSION_MAX_HOURS ?? '8', 10)) * 3_600_000;
const DEVICE_TTL_DAYS = parseInt(process.env.TRUSTED_DEVICE_DAYS ?? '30', 10);

export default async function handler(req: Request, res: Response) {
  const { challengeId, otp, rememberDevice } = req.body as {
    challengeId?: string;
    otp?: string;
    rememberDevice?: boolean;
  };
  const ip = req.ip ?? 'unknown';
  const ua = req.headers['user-agent'] ?? 'unknown';

  if (!challengeId || !otp) {
    return res.status(400).json({ ok: false, error: 'challengeId and otp are required' });
  }

  // Get the email before verifying (so we can record brute-force on failure)
  const email = getChallengeEmail(challengeId);
  if (!email) {
    return res.status(400).json({ ok: false, error: 'Invalid or expired verification session. Please log in again.' });
  }

  // Verify OTP
  const result = verifyOtp(challengeId, otp);

  if (!result.ok) {
    recordLoginFailure(email, ip);
    appendAudit({ event: 'otp_failed', email, ip, reason: result.locked ? 'otp_locked' : result.expired ? 'otp_expired' : 'wrong_otp' });
    await appendLoginEvent('admin', email, 'otp_failed', ip, ua);
    return res.status(401).json({ ok: false, error:   result.error,
      locked:  result.locked  ?? false,
      expired: result.expired ?? false,
    });
  }

  // OTP verified — look up admin
  const admin = await findAdminByEmail(email);
  if (!admin) {
    // Should never happen — email came from the challenge we issued
    return res.status(500).json({ ok: false, error: 'Admin account not found' });
  }

  recordLoginSuccess(email, ip);

  // Create session
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  await createSession(sessionToken, {
    adminId:   admin.id,
    email:     admin.email,
    role:      (admin.role === 'superadmin' ? 'SUPER_ADMIN' : admin.role) as 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'SECURITY_ADMIN' | 'SUPPORT_ADMIN' | 'COMPLIANCE_ADMIN',
    createdAt: now,
    lastSeenAt: now,
    ip,
    ua,
  });

  appendAudit({ event: 'login_success', adminId: admin.id, email, ip });
  await appendLoginEvent('admin', admin.email, 'success', ip, ua, {
    userId: admin.id,
    sessionId: sessionToken.slice(0, 8),
  });

  // Set session cookie
  res.cookie(COOKIE_NAME, sessionToken, sessionCookieOptions(SESSION_MAX_MS));

  // Optionally register trusted device
  let deviceRegistered = false;
  if (rememberDevice) {
    const { token: deviceToken, expiresAt } = await registerTrustedDevice(admin.id, admin.email, ip, ua);
    res.cookie(DEVICE_COOKIE, deviceToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   DEVICE_TTL_DAYS * 86_400_000,
      path:     '/',
    });
    appendAudit({ event: 'trusted_device_registered', adminId: admin.id, email, ip, meta: { expiresAt: expiresAt.toISOString() } });
    deviceRegistered = true;
  }

  // Fire-and-forget login alert
  sendAdminLoginAlertEmail(admin.email, admin.name, ip, ua, undefined, false).catch(() => {});

  return res.json({
    ok:    true,
    token: sessionToken,
    deviceRegistered,
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role, avatar: admin.avatar },
  });
}
