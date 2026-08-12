import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit, appendCriticalAudit } from '../../../../lib/auditLog.js';
import { sendApprovalEmail } from '../../../../lib/emailService.js';
import { evaluateFinancialAccess } from '../../../../lib/complianceGate.js';
import { sanitizeNote } from '../../../../lib/inputValidator.js';
import { getLatestOnboardingCaseForUser } from '../../../../lib/onboardingStore.js';
import { assertProviderVerificationComplete } from '../../../../lib/onboardingProviderStore.js';

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

  if (!user.kycReviewedBy || !user.amlReviewedBy) {
    return res.status(409).json({ error: 'Recorded KYC and AML reviewers are required before final registration approval.', code: 'REVIEW_HISTORY_REQUIRED' });
  }

  // A signed, allow-listed provider verification is the independent maker;
  // the sole super-administrator is the accountable checker. This avoids
  // hidden administrator accounts without allowing self-generated evidence.
  const onboardingCase = await getLatestOnboardingCaseForUser(userId);
  if (!onboardingCase) return res.status(409).json({ error: 'A provider-backed onboarding case is required.', code: 'ONBOARDING_CASE_REQUIRED' });
  try {
    await assertProviderVerificationComplete(onboardingCase.id, onboardingCase.caseType);
  } catch (error) {
    const typed = error as Error & { code?: string };
    return res.status(409).json({ error: typed.message, code: typed.code });
  }

  const compliance = await evaluateFinancialAccess({ ...user, status: 'active' });
  if (!compliance.allowed) {
    return res.status(409).json({
      error: `Account activation blocked: ${compliance.message}`,
      code: compliance.code,
      compliance,
    });
  }

  await appendCriticalAudit({ event: 'admin_user_approve_intent', adminId: session.adminId, userId, email: session.email, reason,
    meta: { targetEmail: user.email, previousStatus: user.status, kycStatus: user.kycStatus, amlStatus: user.amlStatus }, ip: req.ip });
  await updateUser(userId, { status: 'active', approvedAt: new Date().toISOString(), approvedBy: session.adminId });

  appendAudit({ event: 'admin_user_approve', adminId: session.adminId, userId, email: user.email, reason,
    meta: { previousStatus: user.status, kycStatus: user.kycStatus, amlStatus: user.amlStatus, finalRegistrationApproval: true } });

  await sendApprovalEmail(user.email, user.name);

  return res.json({ ok: true, message: `${user.name} has been activated after KYC and AML clearance.` });
}
