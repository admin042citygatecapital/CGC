import type { Request, Response } from 'express';
import { getOnboardingCaseBundle, getOnboardingQueuePosition, getRegistrationIntakePosition, listOnboardingCases, listOnboardingQueueIds, listRegistrationIntakeQueueIds, type OnboardingStatus } from '../../../lib/onboardingStore.js';
import { buildRegistrationWorkflow } from '../../../lib/registrationWorkflow.js';
import { findUserById } from '../../../lib/userStore.js';
import { ONBOARDING_COMPLIANCE_MAP } from '../../../lib/onboardingComplianceMap.js';

const STATUSES = new Set(['draft', 'submitted', 'under_review', 'needs_info', 'approved', 'rejected', 'expired']);
export default async function handler(req: Request, res: Response) {
  const caseId = String(req.query.caseId ?? '');
  if (caseId) {
    const bundle = await getOnboardingCaseBundle(caseId);
    if (!bundle) return res.status(404).json({ error: 'Onboarding case not found.' });
    const user = await findUserById(bundle.case.userId);
    const [queuePosition, intakePosition] = await Promise.all([
      getOnboardingQueuePosition(bundle.case.id),
      getRegistrationIntakePosition(bundle.case.id),
    ]);
    return res.json({
      ...bundle,
      workflow: user ? buildRegistrationWorkflow(user, bundle.case, bundle.evidence.length, queuePosition) : null,
      intakePosition,
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
  const [cases, queued, intake] = await Promise.all([
    listOnboardingCases(raw as OnboardingStatus || undefined),
    listOnboardingQueueIds(),
    listRegistrationIntakeQueueIds(),
  ]);
  const queuePositions = new Map(queued.map((record, index) => [record.id, index + 1]));
  const intakePositions = new Map(intake.map((record, index) => [record.id, index + 1]));
  return res.json({
    data: cases.map((record) => ({
      ...record,
      queuePosition: queuePositions.get(record.id) ?? null,
      intakePosition: intakePositions.get(record.id) ?? null,
    })),
    controls: ONBOARDING_COMPLIANCE_MAP,
    programme: {
      launchJurisdiction: 'UNDECIDED',
      liveIdentityProviderConnected: false,
      liveScreeningProviderConnected: false,
      filingsEnabled: false,
      financialActivationEffect: 'NONE',
    },
  });
}
