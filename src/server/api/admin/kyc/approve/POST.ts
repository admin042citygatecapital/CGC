/**
 * POST /api/admin/kyc/approve
 * Approve a KYC submission. Sends approval email.
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sendApprovalEmail } from '../../../../lib/emailService.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, note } = req.body as { userId?: string; note?: string };
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  await updateUser(userId, {
    status:       'active',
    kycStatus:    'approved',
    kycApprovedAt: new Date().toISOString(),
    approvedAt:   new Date().toISOString(),
    approvedBy:   session.adminId,
  });

  appendAudit({
    event:   'admin_kyc_approve',
    adminId: session.adminId,
    userId,
    email:   user.email,
    reason:  note,
    ip:      req.ip ?? 'unknown',
  });

  await sendApprovalEmail(user.email, user.name);

  return res.json({ ok: true, message: `${user.name} KYC approved.` });
}
