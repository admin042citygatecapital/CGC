import type { Request, Response } from 'express';
import { getOnboardingCaseBundle, listOnboardingCases, type OnboardingStatus } from '../../../lib/onboardingStore.js';
import { findUserById } from '../../../lib/userStore.js';

const STATUSES = new Set(['draft', 'submitted', 'under_review', 'needs_info', 'approved', 'rejected', 'expired']);
export default async function handler(req: Request, res: Response) {
  const caseId = String(req.query.caseId ?? '');
  if (caseId) {
    const bundle = await getOnboardingCaseBundle(caseId);
    if (!bundle) return res.status(404).json({ error: 'Onboarding case not found.' });
    const user = await findUserById(bundle.case.userId);
    return res.json({
      ...bundle,
      customer: user ? {
        id: user.id, name: user.name, email: user.email, status: user.status,
        emailVerified: user.emailVerified, kycStatus: user.kycStatus,
        amlStatus: user.amlStatus, amlRiskLevel: user.amlRiskLevel,
        kycApprovedAt: user.kycApprovedAt, amlReviewedAt: user.amlReviewedAt,
        amlNextReviewAt: user.amlNextReviewAt, kycReviewedBy: user.kycReviewedBy,
        approvedBy: user.approvedBy,
        amlReviewedBy: user.amlReviewedBy,
      } : null,
    });
  }
  const raw = String(req.query.status ?? '');
  if (raw && !STATUSES.has(raw)) return res.status(400).json({ error: 'Invalid onboarding status.' });
  return res.json({ data: await listOnboardingCases(raw as OnboardingStatus || undefined) });
}
