/**
 * POST /api/users/2fa/disable
 * Turns two-factor authentication off. Requires BOTH the current password
 * and a second factor (a valid TOTP code or an unused recovery code), so a
 * stolen password alone cannot silently strip 2FA. Recovery codes make the
 * flow survivable when the authenticator device is lost.
 */
import type { Request, Response } from 'express';
import { updateUser } from '../../../../lib/userStore.js';
import { verifyPassword } from '../../../../lib/passwordHash.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { consumeRecoveryCode, verifyTotp } from '../../../../lib/totp.js';
import { isRateLimited } from '../../../../lib/rateLimiter.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (!user.totpEnabled) return res.status(409).json({ error: 'Two-factor authentication is not enabled' });

  if (isRateLimited(`customer_2fa_disable:${user.id}`, { windowMs: 15 * 60_000, max: 8 })) {
    return res.status(429).json({ error: 'Too many attempts. Please wait 15 minutes.', code: 'DISABLE_LOCKED' });
  }

  const { currentPassword, code } = req.body ?? {};
  if (!currentPassword || typeof currentPassword !== 'string') {
    return res.status(400).json({ error: 'Your current password is required' });
  }
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'A 6-digit code or a recovery code is required' });
  }

  const passwordResult = await verifyPassword(String(currentPassword), user.passwordHash);
  if (!passwordResult.ok) {
    appendAudit({ event: 'customer_2fa_disable_denied', userId: user.id, email: user.email, ip: req.ip, meta: { reason: 'wrong_password' } });
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const codeInput = String(code).trim();
  const secondFactor = user.totpSecret && verifyTotp(user.totpSecret, codeInput)
    ? 'totp'
    : user.totpRecoveryHashes && consumeRecoveryCode(user.totpRecoveryHashes, codeInput)
      ? 'recovery_code'
      : null;

  if (!secondFactor) {
    appendAudit({ event: 'customer_2fa_disable_failed', userId: user.id, email: user.email, ip: req.ip, meta: { reason: 'invalid_code' } });
    return res.status(401).json({ error: 'Invalid or expired code' });
  }

  await updateUser(user.id, { totpEnabled: false, totpSecret: null, totpRecoveryHashes: null });
  appendAudit({
    event: 'customer_2fa_disabled',
    userId: user.id,
    email: user.email,
    ip: req.ip,
    meta: { secondFactor },
  });
  return res.json({ ok: true, message: 'Two-factor authentication is disabled.' });
}