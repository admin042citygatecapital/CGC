/**
 * POST /api/admin/kyc/reject
 * Reject a KYC submission with a mandatory reason. Sends rejection email.
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit, appendCriticalAudit } from '../../../../lib/auditLog.js';
import { sendRejectionEmail } from '../../../../lib/emailService.js';
import { getLatestOnboardingCaseForUser, reviewOnboardingCase } from '../../../../lib/onboardingStore.js';
import { createNotification } from '../../../../lib/notificationStore.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, reason, reasonCode } = req.body as {
    userId?: string; reason?: string; reasonCode?: string;
  };
  if (!userId)  return res.status(400).json({ error: 'userId required' });
  if (!reason)  return res.status(400).json({ error: 'reason required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const onboardingCase = await getLatestOnboardingCaseForUser(userId);
  if (!onboardingCase) return res.status(409).json({ error: 'A submitted onboarding case is required.', code: 'ONBOARDING_CASE_REQUIRED' });
  await appendCriticalAudit({ event: 'admin_kyc_reject_intent', adminId: session.adminId, userId, email: user.email, reason, meta: { reasonCode }, ip: req.ip ?? 'unknown' });
  try {
    await reviewOnboardingCase({ caseId: onboardingCase.id, reviewerId: session.adminId, decision: 'rejected', reason });
  } catch (error) {
    const typed = error as Error & { code?: string };
    return res.status(409).json({ error: typed.message, code: typed.code });
  }

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
  await createNotification(userId, 'Identity review needs attention', reason, '/kyc');

  return res.json({ ok: true, message: `${user.name} KYC rejected.` });
}
