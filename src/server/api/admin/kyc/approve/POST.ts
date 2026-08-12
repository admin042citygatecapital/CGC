/**
 * POST /api/admin/kyc/approve
 * Approve a KYC submission. Sends approval email.
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit, appendCriticalAudit } from '../../../../lib/auditLog.js';
import { sendApprovalEmail } from '../../../../lib/emailService.js';
import { addUtcMonths, appendKycNote, readKycSettings } from '../../../../lib/kycStore.js';
import { sanitizeNote } from '../../../../lib/inputValidator.js';
import { getLatestOnboardingCaseForUser, reviewOnboardingCase } from '../../../../lib/onboardingStore.js';
import { createNotification } from '../../../../lib/notificationStore.js';
import { assertProviderVerificationComplete } from '../../../../lib/onboardingProviderStore.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId } = req.body as { userId?: string };
  const note = sanitizeNote(req.body?.note ?? '');
  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (note.length < 10) return res.status(400).json({ error: 'A KYC approval rationale of at least 10 characters is required.' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const onboardingCase = await getLatestOnboardingCaseForUser(userId);
  if (!onboardingCase) return res.status(409).json({ error: 'A submitted onboarding case is required.', code: 'ONBOARDING_CASE_REQUIRED' });
  const approvedAt = new Date();
  const settings = await readKycSettings();
  await appendCriticalAudit({ event: 'admin_kyc_approve_intent', adminId: session.adminId, userId, email: user.email, reason: note, ip: req.ip ?? 'unknown' });
  try {
    await assertProviderVerificationComplete(onboardingCase.id, onboardingCase.caseType);
    await reviewOnboardingCase({ caseId: onboardingCase.id, reviewerId: session.adminId, decision: 'approved', reason: note });
  } catch (error) {
    const typed = error as Error & { code?: string };
    return res.status(409).json({ error: typed.message, code: typed.code });
  }

  await updateUser(userId, {
    status:       'pending_approval',
    kycStatus:    'approved',
    kycApprovedAt: approvedAt.toISOString(),
    kycExpiresAt: addUtcMonths(approvedAt, settings.expiryMonths).toISOString(),
    kycReviewedBy: session.adminId,
    kycReviewReason: note,
    kycRejectedAt: '',
    kycRejectionReason: '',
    amlStatus:    'pending',
    amlRiskLevel: 'unrated',
    amlReviewedAt: '',
    amlReviewedBy: '',
    amlReviewReason: '',
    amlNextReviewAt: '',
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
  await createNotification(userId, 'Identity review complete', 'Your identity review is approved. AML screening remains pending and financial services are not active.', '/kyc');

  return res.json({ ok: true, message: `${user.name} KYC approved. AML clearance is now pending.` });
}
