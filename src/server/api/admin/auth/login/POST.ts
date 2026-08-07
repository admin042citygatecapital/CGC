/**
 * POST /api/admin/auth/login
 *
 * Body: { email, password }
 *
 * Validates credentials and creates a session immediately — no OTP step.
 * All other security systems remain active:
 *  - Brute-force lockout (per-email + per-IP, exponential backoff)
 *  - Timing-safe bcrypt password comparison
 *  - HttpOnly Secure session cookie
 *  - Full audit + login log on every outcome
 *  - Login alert email on success
 */
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { findAdminByEmail, verifyPassword } from '../../../../lib/adminCredentials.js';
import { createSession } from '../../../../lib/sessionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { appendLoginEvent } from '../../../../lib/loginLog.js';
import { checkLockout, recordLoginFailure, recordLoginSuccess, getFailCount } from '../../../../lib/bruteForce.js';
import { COOKIE_NAME, sessionCookieOptions } from '../../../../lib/adminAuthMiddleware.js';
import { sendAdminLoginAlertEmail } from '../../../../lib/emailService.js';

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
  const admin = findAdminByEmail(email);

  // Always run bcrypt compare to prevent timing-based user enumeration
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

  // ── Credentials valid — create session immediately ───────────────────────
  await recordLoginSuccess(email, ip);

  const sessionToken = crypto.randomBytes(32).toString('hex');
  await createSession(sessionToken, {
    adminId:   admin.id,
    email:     admin.email,
    role:      (admin.role === 'superadmin' ? 'SUPER_ADMIN' : admin.role) as import('../../../../lib/sessionStore.js').AdminRole,
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
  sendAdminLoginAlertEmail(admin.email, admin.name, ip, ua, undefined, false).catch(() => {});

  // Set HttpOnly session cookie
  res.cookie(COOKIE_NAME, sessionToken, sessionCookieOptions(SESSION_MAX_MS));

  return res.json({
    ok:    true,
    token: sessionToken,
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role, avatar: admin.avatar },
  });
}
