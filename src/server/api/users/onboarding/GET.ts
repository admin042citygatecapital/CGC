import type { Request, Response } from 'express';
import { getOnboardingCaseBundle, getOnboardingQueuePosition, getOrCreateOnboardingCase, getRegistrationIntakePosition } from '../../../lib/onboardingStore.js';
import { buildRegistrationWorkflow } from '../../../lib/registrationWorkflow.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser!;
  const caseType = user.accountTier === 'business' ? 'business' : 'individual';
  const record = await getOrCreateOnboardingCase(user.id, caseType, user.id);
  const bundle = await getOnboardingCaseBundle(record.id);
  if (!bundle) return res.status(404).json({ error: 'Onboarding case not found.' });
  const [queuePosition, intakePosition] = await Promise.all([
    getOnboardingQueuePosition(record.id),
    getRegistrationIntakePosition(record.id),
  ]);
  return res.json({
    ...bundle,
    workflow: buildRegistrationWorkflow(user, bundle.case, bundle.evidence.length, queuePosition),
    intakePosition,
  });
}
