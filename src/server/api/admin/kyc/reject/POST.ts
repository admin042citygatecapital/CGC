/**
 * POST /api/admin/kyc/reject
 * Reject a KYC submission with a mandatory reason. Sends rejection email.
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sendRejectionEmail } from '../../../../lib/emailService.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, reason, reasonCode } = req.body as {
    userId?: string; reason?: string; reasonCode?: string;
  };
  if (!userId)  return res.status(400).json({ error: 'userId required' });
  if (!reason)  return res.status(400).json({ error: 'reason required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  await updateUser(userId, {
    status:             'rejected',
    kycStatus:          'rejected',
    kycRejectedAt:      new Date().toISOString(),
    kycRejectionReason: reason,
    rejectedAt:         new Date().toISOString(),
    rejectedBy:         session.adminId,
    rejectionReason:    reason,
  });

  appendAudit({
    event:   'admin_kyc_reject',
    adminId: session.adminId,
    userId,
    email:   user.email,
    reason,
    meta:    { reasonCode },
    ip:      req.ip ?? 'unknown',
  });

  await sendRejectionEmail(user.email, user.name, reason);

  return res.json({ ok: true, message: `${user.name} KYC rejected.` });
}
