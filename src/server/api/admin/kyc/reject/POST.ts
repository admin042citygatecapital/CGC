/**
 * POST /api/admin/kyc/reject
 * Body: { userId, reason }
 * See admin/kyc/approve/POST.ts's comment — deliberately not built against
 * the non-existent kycStore submissions functions the userId-scoped sibling
 * route calls.
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendKYCAudit } from '../../../../lib/kycAuditStore.js';
import { sendRejectionEmail } from '../../../../lib/emailService.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId } = req.body as { userId?: string };
  const reason = sanitizeString((req.body as { reason?: unknown }).reason, 500);
  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });
  if (!reason) return res.status(400).json({ ok: false, error: 'reason is required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  await updateUser(userId, {
    kycStatus: 'rejected',
    kycRejectedAt: new Date().toISOString(),
    kycRejectionReason: reason,
  } as never);

  appendKYCAudit({
    kycSubmissionId: userId, userId, reviewerEmail: session.email, reviewerId: session.adminId,
    action: 'rejected', previousStatus: user.kycStatus, newStatus: 'rejected', notes: reason, reviewerIp: req.ip ?? 'unknown',
  });
  appendAudit({ event: 'admin_kyc_reject', adminId: session.adminId, userId, email: user.email, ip: req.ip ?? 'unknown', reason });

  sendRejectionEmail(user.email, user.name, reason).catch(() => {});

  return res.json({ ok: true, message: `${user.name}'s KYC has been rejected.` });
}
