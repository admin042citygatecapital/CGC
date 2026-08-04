/**
 * POST /api/users/2fa/setup
 * Body: { action: 'enable' } — sends a 6-digit email OTP; complete
 *       enrollment via POST /api/users/2fa/verify with the returned
 *       challengeId.
 *       { action: 'disable', currentPassword } — immediately disables 2FA
 *       after confirming the account password (no OTP needed to turn a
 *       security feature off, but the account password must be proven).
 *
 * This is email-OTP based (via otpStore.ts, the same mechanism admin 2FA
 * already uses), not authenticator-app TOTP — there's no TOTP/HOTP library
 * in this codebase. UserRecord.totpEnabled is repurposed here as the
 * "2FA is enabled" flag; totpSecret is left untouched (nothing to store
 * in an email-OTP model).
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser } from '../../../../lib/userStore.js';
import { verifyPassword } from '../../../../lib/passwordHash.js';
import { issueOtp } from '../../../../lib/otpStore.js';
import { sendOtpEmail } from '../../../../lib/emailService.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { isOneOf } from '../../../../lib/inputValidator.js';

const ACTIONS = ['enable', 'disable'] as const;

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const raw = req.body as { action?: unknown; currentPassword?: unknown };
  const action = isOneOf(raw.action, ACTIONS);
  const ip = req.ip ?? 'unknown';
  const ua = String(req.headers['user-agent'] ?? 'unknown');

  if (action === 'disable') {
    if (user.totpEnabled !== true) {
      return res.status(400).json({ ok: false, error: '2FA is not currently enabled' });
    }
    const currentPassword = typeof raw.currentPassword === 'string' ? raw.currentPassword : '';
    if (!currentPassword) {
      return res.status(400).json({ ok: false, error: 'currentPassword is required to disable 2FA' });
    }
    const { ok: passwordOk } = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordOk) {
      return res.status(403).json({ ok: false, error: 'Current password is incorrect' });
    }
    await updateUser(user.id, { totpEnabled: false } as never);
    appendAudit({ event: 'user_2fa_disabled', userId: user.id, email: user.email, ip });
    return res.json({ ok: true, totpEnabled: false });
  }

  if (action !== 'enable') {
    return res.status(400).json({ ok: false, error: "action must be 'enable' or 'disable'" });
  }
  if (user.totpEnabled === true) {
    return res.status(400).json({ ok: false, error: '2FA is already enabled' });
  }

  const issued = issueOtp(user.email, ip, ua);
  if (!issued.ok || !issued.challengeId || !issued.otp) {
    return res.status(429).json({ ok: false, error: issued.error ?? 'Failed to issue verification code' });
  }

  await sendOtpEmail(user.email, user.name, issued.otp);
  appendAudit({ event: 'user_2fa_setup_requested', userId: user.id, email: user.email, ip });

  return res.json({ ok: true, challengeId: issued.challengeId, message: 'Verification code sent to your email.' });
}
