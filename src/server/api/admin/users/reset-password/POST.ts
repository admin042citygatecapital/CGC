/**
 * POST /api/admin/users/reset-password
 * Admin sets a new password for a customer (force-reset) and invalidates
 * their active sessions.
 */
import type { Request, Response } from 'express';
import { hashPassword } from '../../../../lib/passwordHash.js';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { deleteAllCustomerSessions } from '../../../../lib/customerSessionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { validatePassword } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, newPassword } = req.body as { userId?: string; newPassword?: string };

  if (!userId || !newPassword) {
    return res.status(400).json({ ok: false, error: 'userId and newPassword are required' });
  }
  const pwCheck = validatePassword(newPassword);
  if (!pwCheck.ok) return res.status(400).json({ ok: false, error: pwCheck.reason ?? 'Weak password' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  const passwordHash = await hashPassword(newPassword);
  await updateUser(userId, { passwordHash, loginAttempts: 0 });
  await deleteAllCustomerSessions(userId);

  appendAudit({
    event: 'admin_user_password_reset',
    adminId: session.adminId,
    userId,
    email: user.email,
    ip: req.ip ?? 'unknown',
  });

  return res.json({ ok: true, message: `Password reset for ${user.name}. Active sessions invalidated.` });
}
