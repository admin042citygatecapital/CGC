/**
 * POST /api/users/password-reset/confirm
 * Validates the reset token and sets a new password.
 */
import type { Request, Response } from 'express';
import { hashPassword } from '../../../../lib/passwordHash.js';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { deleteAllCustomerSessions } from '../../../../lib/customerSessionStore.js';
import { sanitizeString, validatePassword } from '../../../../lib/inputValidator.js';
import { consumeCustomerResetToken } from '../../../../lib/customerResetTokenStore.js';

export default async function handler(req: Request, res: Response) {
  const token    = sanitizeString(req.body?.token);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const ip       = req.ip ?? 'unknown';

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) {
    return res.status(400).json({ error: pwCheck.reason });
  }

  const userId = await consumeCustomerResetToken(token);
  const user = userId ? await findUserById(userId) : undefined;
  if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });

  const passwordHash = await hashPassword(password);
  await updateUser(user.id, { passwordHash });

  // A recovered credential must invalidate every existing browser/device
  // session. Otherwise a stolen session would survive the password reset.
  const revokedSessions = await deleteAllCustomerSessions(user.id);

  appendAudit({
    event: 'password_reset_completed', userId: user.id, email: user.email, ip,
    meta: { revokedSessions },
  });

  return res.json({ ok: true, message: 'Password updated successfully. You can now log in.' });
}
