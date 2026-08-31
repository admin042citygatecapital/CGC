import type { Request, Response } from 'express';
import { isDatabaseConfigured } from '../../../db/db.js';
import { getOnboardingCaseBundle, getOnboardingQueuePosition, getOrCreateOnboardingCase, getRegistrationIntakePosition } from '../../../lib/onboardingStore.js';
import { buildRegistrationWorkflow } from '../../../lib/registrationWorkflow.js';
import { getKycProfile, listKycDocuments } from '../../../lib/kycPrivateStore.js';
import { onboardingProviderConfigured } from '../../../lib/onboardingProviderWebhook.js';

export default async function handler(req: Request, res: Response) {
  if (!isDatabaseConfigured()) {
    return res.status(503).json({
      error: 'Registration workflow storage is not configured.',
      code: 'ONBOARDING_STORAGE_UNAVAILABLE',
    });
  }
  const user = req.customerUser!;
  const caseType = user.accountTier === 'business' ? 'business' : 'individual';
  const record = await getOrCreateOnboardingCase(user.id, caseType, user.id);
  const bundle = await getOnboardingCaseBundle(record.id);
  if (!bundle) return res.status(404).json({ error: 'Onboarding case not found.' });
  const [queuePosition, intakePosition, profile, documents] = await Promise.all([
    getOnboardingQueuePosition(record.id),
    getRegistrationIntakePosition(record.id),
    getKycProfile(user.id),
    listKycDocuments(record.id),
  ]);
  return res.json({
    case: {
      id: bundle.case.id,
      caseType: bundle.case.caseType,
      status: bundle.case.status,
      version: bundle.case.version,
      submittedAt: bundle.case.submittedAt,
      reviewedAt: bundle.case.reviewedAt,
      reviewReason: bundle.case.reviewReason,
      requestedEvidenceKinds: bundle.case.requestedEvidenceKinds,
      customerInstructions: bundle.case.customerInstructions,
      updatedAt: bundle.case.updatedAt,
    },
    evidence: bundle.evidence.map(item => ({ id: item.id, kind: item.kind, referenceType: item.referenceType, sha256: item.sha256, createdAt: item.createdAt })),
    events: bundle.events.map(event => ({ id: event.id, action: event.action, fromStatus: event.fromStatus, toStatus: event.toStatus, createdAt: event.createdAt })),
    provider: { configured: onboardingProviderConfigured(), identityAccepted: bundle.providerVerifications.checks.identityAccepted, screeningClear: bundle.providerVerifications.checks.screeningClear },
    profile,
    documents,
    workflow: buildRegistrationWorkflow(user, bundle.case, bundle.evidence.length, queuePosition),
    intakePosition,
  });
}
