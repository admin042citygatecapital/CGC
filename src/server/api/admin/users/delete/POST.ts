/**
 * POST /api/admin/users/delete
 * Permanently deletes a customer record. SUPER_ADMIN only.
 * Writes a tombstone audit entry before deletion (row is gone after).
 */
import type { Request, Response } from 'express';
import { findUserById, deleteUser } from '../../../../lib/userStore.js';
import { deleteAllCustomerSessions } from '../../../../lib/customerSessionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, reason } = req.body as { userId?: string; reason?: string };

  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  appendAudit({
    event: 'admin_user_deleted',
    adminId: session.adminId,
    userId: user.id,
    email: user.email,
    ip: req.ip ?? 'unknown',
    reason: reason ? sanitizeString(reason, 500) : 'Admin deletion',
    meta: { name: user.name, status: user.status, kycStatus: user.kycStatus },
  });

  await deleteAllCustomerSessions(userId);
  const ok = await deleteUser(userId);
  if (!ok) return res.status(500).json({ ok: false, error: 'Failed to delete user' });

  return res.json({ ok: true, message: `Account for ${user.name} permanently deleted` });
}
