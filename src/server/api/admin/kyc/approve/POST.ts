/**
 * POST /api/admin/kyc/approve
 * Approve a KYC submission. Sends approval email.
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sendApprovalEmail } from '../../../../lib/emailService.js';
import { appendKycNote } from '../../../../lib/kycStore.js';
import { sanitizeNote } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId } = req.body as { userId?: string };
  const note = sanitizeNote(req.body?.note ?? '');
  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (note.length < 10) return res.status(400).json({ error: 'A KYC approval rationale of at least 10 characters is required.' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  await updateUser(userId, {
    status:       'pending_approval',
    kycStatus:    'approved',
    kycApprovedAt: new Date().toISOString(),
    amlStatus:    'pending',
    amlRiskLevel: 'unrated',
    amlReviewedAt: '',
    amlReviewedBy: '',
    amlReviewReason: '',
    amlNextReviewAt: '',
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

  await appendKycNote({
    userId,
    adminId: session.adminId,
    adminName: session.email,
    note: `KYC approval rationale: ${note}`,
    createdAt: new Date().toISOString(),
  });

  await sendApprovalEmail(user.email, user.name);

  return res.json({ ok: true, message: `${user.name} KYC approved. AML clearance is now pending.` });
}
