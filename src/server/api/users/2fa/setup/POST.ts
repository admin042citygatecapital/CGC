/**
 * POST /api/users/2fa/setup
 * Generates a TOTP secret for the customer to scan with an authenticator app.
 * Returns { secret, qrUrl } — the secret is shown once; the customer must verify it.
 */
import type { Request, Response } from 'express';
import { updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { generateTotpSecret } from '../../../../lib/totp.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  if (user.totpEnabled) return res.status(409).json({ error: 'Two-factor authentication is already enabled' });

  // Generate a 20-byte random secret and encode as base32
  const secret      = generateTotpSecret();
  const issuer      = 'City Gate Capital';
  const label       = encodeURIComponent(`${issuer}:${user.email}`);
  const qrUrl       = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

  await updateUser(user.id, { totpSecret: secret, totpEnabled: false });
  appendAudit({ event: 'customer_2fa_setup_started', userId: user.id, email: user.email, ip: req.ip });
  return res.json({ secret, qrUrl });
}
