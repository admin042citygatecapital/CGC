/**
 * POST /api/admin/users/reset-2fa
 * Clears a customer's TOTP secret and invalidates their active sessions,
 * forcing re-login and re-enrollment.
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { deleteAllCustomerSessions } from '../../../../lib/customerSessionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId } = req.body as { userId?: string };

  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  await updateUser(userId, { totpSecret: null, totpEnabled: false });
  await deleteAllCustomerSessions(userId);

  appendAudit({
    event: 'admin_user_2fa_reset',
    adminId: session.adminId,
    userId,
    email: user.email,
    ip: req.ip ?? 'unknown',
  });

  return res.json({ ok: true, message: `2FA cleared for ${user.name}. They must re-enroll on next login.` });
}
