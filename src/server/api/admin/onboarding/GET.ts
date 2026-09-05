import type { Request, Response } from 'express';
import { getOnboardingCaseBundle, getOnboardingQueuePosition, getRegistrationIntakePosition, listOnboardingCases, listOnboardingQueueIds, listRegistrationIntakeQueueIds, type OnboardingStatus } from '../../../lib/onboardingStore.js';
import { buildRegistrationWorkflow } from '../../../lib/registrationWorkflow.js';
import { findUserById } from '../../../lib/userStore.js';
import { ONBOARDING_COMPLIANCE_MAP } from '../../../lib/onboardingComplianceMap.js';
import { getKycProfile, listKycDocuments } from '../../../lib/kycPrivateStore.js';
import { getSumsubReadiness } from '../../../lib/onboardingProviderReadiness.js';

const STATUSES = new Set(['draft', 'submitted', 'under_review', 'needs_info', 'approved', 'rejected', 'expired']);
export default async function handler(req: Request, res: Response) {
  const caseId = String(req.query.caseId ?? '');
  if (caseId) {
    const bundle = await getOnboardingCaseBundle(caseId);
    if (!bundle) return res.status(404).json({ error: 'Onboarding case not found.' });
    const user = await findUserById(bundle.case.userId);
    const [queuePosition, intakePosition, profile, documents] = await Promise.all([
      getOnboardingQueuePosition(bundle.case.id),
      getRegistrationIntakePosition(bundle.case.id),
      getKycProfile(bundle.case.userId),
      listKycDocuments(bundle.case.id, true),
    ]);
    return res.json({
      case: bundle.case,
      evidence: bundle.evidence.map(item => ({ id: item.id, kind: item.kind, referenceType: item.referenceType, sha256: item.sha256, createdAt: item.createdAt })),
      events: bundle.events,
      providerVerifications: bundle.providerVerifications,
      profile,
      documents,
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
  const [cases, queued, intake, sumsub] = await Promise.all([
    listOnboardingCases(raw as OnboardingStatus || undefined),
    listOnboardingQueueIds(),
    listRegistrationIntakeQueueIds(),
    getSumsubReadiness(),
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
    sumsub,
    programme: {
      launchJurisdiction: 'UNDECIDED',
      liveIdentityProviderConnected: false,
      liveScreeningProviderConnected: false,
      filingsEnabled: false,
      financialActivationEffect: 'NONE',
    },
  });
}
