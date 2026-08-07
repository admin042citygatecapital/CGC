/**
 * POST /api/admin/kyc/flag
 * Flag a KYC submission for manual review.
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { appendKycNote } from '../../../../lib/kycStore.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, note } = req.body as { userId?: string; note?: string };
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Keep kycStatus as 'submitted' but add a note
  if (note) {
    appendKycNote({ userId, adminId: session.adminId, note: `[FLAGGED] ${note}`, createdAt: new Date().toISOString() });
  }

  await updateUser(userId, { updatedAt: new Date().toISOString() });

  appendAudit({
    event:   'admin_kyc_flag',
    adminId: session.adminId,
    userId,
    email:   user.email,
    reason:  note,
    ip:      req.ip ?? 'unknown',
  });

  return res.json({ ok: true, message: `${user.name} flagged for manual review.` });
}
