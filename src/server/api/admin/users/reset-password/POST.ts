/**
 * POST /api/admin/users/reset-password
 * Admin sets a new password for a customer (force-reset).
 * Invalidates the customer's current session.
 */
import type { Request, Response } from 'express';
import { hashPassword } from '../../../../lib/passwordHash.js';
import { findUserById } from '../../../../lib/userStore.js';
import { appendAudit, appendCriticalAudit } from '../../../../lib/auditLog.js';
import { CustomerCredentialRotationError, rotateCustomerPasswordCredential } from '../../../../lib/customerCredentialRotation.js';
import { validatePassword } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, newPassword } = req.body as { userId?: string; newPassword?: string };

  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'userId and newPassword required' });
  }
  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.ok) return res.status(400).json({ error: passwordCheck.reason });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  try {
    const passwordHash = await hashPassword(newPassword);
    await appendCriticalAudit({ event: 'admin_user_password_reset_intent', adminId: session.adminId, userId,
      email: session.email, ip: req.ip, meta: { targetEmail: user.email } });
    const rotation = await rotateCustomerPasswordCredential({
      userId,
      passwordHash,
      expectedCredentialVersion: user.credentialVersion,
    });

    appendAudit({
      event: 'admin_user_password_reset',
      adminId: session.adminId,
      userId,
      email: user.email,
      ip: req.ip,
      meta: {
        credentialVersion: rotation.credentialVersion,
        revokedSessions: rotation.revokedSessions,
      },
    });

    return res.json({ ok: true, message: `Password reset for ${user.name}. Active sessions invalidated.` });
  } catch (error) {
    if (error instanceof CustomerCredentialRotationError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    return res.status(503).json({
      error: 'The password reset could not be completed because a protected administration dependency is unavailable.',
      code: 'ADMIN_PASSWORD_RESET_DEPENDENCY_UNAVAILABLE',
    });
  }
}
