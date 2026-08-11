import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sendApprovalEmail } from '../../../../lib/emailService.js';
import { evaluateFinancialAccess } from '../../../../lib/complianceGate.js';
import { sanitizeNote } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;

  if (session.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Only a super-administrator may provide final registration approval.', code: 'SUPER_ADMIN_REQUIRED' });
  }

  const { userId } = req.body as { userId?: string };
  const reason = sanitizeNote(req.body?.reason ?? '').slice(0, 1000);
  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (reason.length < 10) return res.status(400).json({ error: 'A final approval rationale of at least 10 characters is required.' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.status === 'active') {
    return res.status(409).json({ error: 'User is already active' });
  }

  if (user.approvedBy === session.adminId || user.amlReviewedBy === session.adminId) {
    return res.status(409).json({ error: 'Final approval must be completed by a different administrator from the KYC and AML reviewers.', code: 'MAKER_CHECKER_REQUIRED' });
  }

  const compliance = await evaluateFinancialAccess({ ...user, status: 'active' });
  if (!compliance.allowed) {
    return res.status(409).json({
      error: `Account activation blocked: ${compliance.message}`,
      code: compliance.code,
      compliance,
    });
  }

  await updateUser(userId, { status: 'active', approvedAt: new Date().toISOString(), approvedBy: session.adminId });

  appendAudit({ event: 'admin_user_approve', adminId: session.adminId, userId, email: user.email, reason,
    meta: { previousStatus: user.status, kycStatus: user.kycStatus, amlStatus: user.amlStatus, finalRegistrationApproval: true } });

  await sendApprovalEmail(user.email, user.name);

  return res.json({ ok: true, message: `${user.name} has been activated after KYC and AML clearance.` });
}
