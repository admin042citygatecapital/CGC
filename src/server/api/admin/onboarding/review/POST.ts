import type { Request, Response } from 'express';
import { appendAuditEntry } from '../../../../lib/auditLog.js';
import { createNotification } from '../../../../lib/notificationStore.js';
import { getOnboardingCaseBundle, reviewOnboardingCase, type OnboardingStatus } from '../../../../lib/onboardingStore.js';
import { findUserById, updateUser } from '../../../../lib/userStore.js';

const DECISIONS = new Set(['under_review', 'needs_info', 'approved', 'rejected']);
export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const caseId = String(req.body?.caseId ?? '');
  const decision = String(req.body?.decision ?? '') as OnboardingStatus;
  const reason = String(req.body?.reason ?? '');
  if (!caseId || !DECISIONS.has(decision)) return res.status(400).json({ error: 'Valid caseId and decision are required.' });
  try {
    const before = await getOnboardingCaseBundle(caseId);
    if (!before) return res.status(404).json({ error: 'Onboarding case not found.' });
    const user = await findUserById(before.case.userId);
    if (!user) return res.status(404).json({ error: 'Customer not found.' });
    const reviewed = await reviewOnboardingCase({ caseId, reviewerId: session.adminId, decision, reason });
    const patch = decision === 'approved'
      ? { status: 'pending_approval' as const, kycStatus: 'approved' as const, kycApprovedAt: new Date().toISOString(), amlStatus: 'pending' as const }
      : decision === 'rejected'
        ? { status: 'rejected' as const, kycStatus: 'rejected' as const, kycRejectedAt: new Date().toISOString(), kycRejectionReason: reason }
        : decision === 'needs_info'
          ? { status: 'pending_kyc' as const, kycStatus: 'submitted' as const }
          : {};
    await updateUser(user.id, patch);
    await createNotification(user.id, `Onboarding ${decision.replace('_', ' ')}`, decision === 'approved' ? 'Identity review is complete. AML screening remains pending and financial services are not active.' : reason, '/kyc');
    await appendAuditEntry({ adminId: session.adminId, adminEmail: session.email, action: 'admin_onboarding_review', target: 'onboarding_case', targetId: caseId, ip: req.ip, details: { userId: user.id, decision, reason } });
    return res.json({ ok: true, case: reviewed });
  } catch (error) {
    const typed = error as Error & { code?: string };
    const status = typed.code === 'MAKER_CHECKER_REQUIRED' ? 409 : typed.code === 'NOT_FOUND' ? 404 : 400;
    return res.status(status).json({ error: typed.message, code: typed.code });
  }
}
