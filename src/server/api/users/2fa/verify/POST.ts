/**
 * POST /api/users/2fa/verify
 * Verifies the pending TOTP secret and enables two-factor authentication.
 */
import type { Request, Response } from 'express';
import { updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { verifyTotp } from '../../../../lib/totp.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const { code } = req.body ?? {};
  if (!code || String(code).length !== 6) {
    return res.status(400).json({ error: 'A 6-digit code is required' });
  }

  if (!user.totpSecret) return res.status(409).json({ error: 'Start 2FA setup before verification' });
  if (!verifyTotp(user.totpSecret, String(code))) {
    appendAudit({ event: 'customer_2fa_verification_failed', userId: user.id, email: user.email, ip: req.ip });
    return res.status(401).json({ error: 'Invalid or expired verification code' });
  }
  await updateUser(user.id, { totpEnabled: true });
  appendAudit({ event: 'customer_2fa_enabled', userId: user.id, email: user.email, ip: req.ip });
  return res.json({ ok: true, message: '2FA enabled successfully' });
}
