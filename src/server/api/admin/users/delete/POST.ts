/**
 * POST /api/admin/users/delete
 * Permanently deletes a customer record. Requires SUPER_ADMIN role.
 * Writes a tombstone to the audit log before deletion.
 */
import type { Request, Response } from 'express';
import { deleteUser, findUserById } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, reason } = req.body as { userId?: string; reason?: string };

  if (!userId) return res.status(400).json({ error: 'userId required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Write tombstone audit entry BEFORE deletion
  appendAudit({
    event: 'admin_user_deleted',
    adminId: session.adminId,
    userId: user.id,
    email: user.email,
    ip: req.ip,
    reason: reason ?? 'Admin deletion',
    meta: { name: user.name, status: user.status, kycStatus: user.kycStatus },
  });

  try {
    const deleted = await deleteUser(userId);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete user', detail: String(e) });
  }

  return res.json({ ok: true, message: `Account for ${user.name} permanently deleted` });
}
