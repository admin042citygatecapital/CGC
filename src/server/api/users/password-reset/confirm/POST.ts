/**
 * POST /api/users/password-reset/confirm
 * Validates the reset token and sets a new password.
 */
import type { Request, Response } from 'express';
import { hashPassword } from '../../../../lib/passwordHash.js';
import { loadAllUsers, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { deleteAllCustomerSessions } from '../../../../lib/customerSessionStore.js';
import { sanitizeString, validatePassword } from '../../../../lib/inputValidator.js';

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

  const users = await loadAllUsers();
  const user  = users.find(u => (u as never as Record<string, string>).passwordResetToken === token);

  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const expiry = (user as never as Record<string, string>).passwordResetExpiry;
  if (!expiry || new Date(expiry) < new Date()) {
    return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
  }

  const passwordHash = await hashPassword(password);
  await updateUser(user.id, {
    passwordHash,
    passwordResetToken: undefined,
    passwordResetExpiry: undefined,
  } as never);

  // A recovered credential must invalidate every existing browser/device
  // session. Otherwise a stolen session would survive the password reset.
  const revokedSessions = await deleteAllCustomerSessions(user.id);

  appendAudit({
    event: 'password_reset_completed', userId: user.id, email: user.email, ip,
    meta: { revokedSessions },
  });

  return res.json({ ok: true, message: 'Password updated successfully. You can now log in.' });
}
