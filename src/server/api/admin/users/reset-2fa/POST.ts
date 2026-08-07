/**
 * POST /api/admin/users/reset-2fa
 * Clears any TOTP / 2FA secret for a customer and invalidates their session.
 * (Customer 2FA is stored in the user record as totpSecret / totpEnabled.)
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId } = req.body as { userId?: string };

  if (!userId) return res.status(400).json({ error: 'userId required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Clear 2FA fields and invalidate session
  await updateUser(userId, {
    totpSecret:  undefined,
    totpEnabled: false,
    // Invalidate session so user must re-login and re-enroll
    sessionToken:      undefined,
    sessionCreatedAt:  undefined,
    sessionLastSeenAt: undefined,
    sessionExpiresAt:  undefined,
  });

  appendAudit({
    event: 'admin_user_2fa_reset',
    adminId: session.adminId,
    userId,
    email: user.email,
    ip: req.ip,
  });

  return res.json({ ok: true, message: `2FA cleared for ${user.name}. They must re-enroll on next login.` });
}
