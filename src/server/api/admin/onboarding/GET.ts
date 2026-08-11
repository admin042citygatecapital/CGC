import type { Request, Response } from 'express';
import { getOnboardingCaseBundle, listOnboardingCases, type OnboardingStatus } from '../../../lib/onboardingStore.js';

const STATUSES = new Set(['draft', 'submitted', 'under_review', 'needs_info', 'approved', 'rejected', 'expired']);
export default async function handler(req: Request, res: Response) {
  const caseId = String(req.query.caseId ?? '');
  if (caseId) {
    const bundle = await getOnboardingCaseBundle(caseId);
    return bundle ? res.json(bundle) : res.status(404).json({ error: 'Onboarding case not found.' });
  }
  const raw = String(req.query.status ?? '');
  if (raw && !STATUSES.has(raw)) return res.status(400).json({ error: 'Invalid onboarding status.' });
  return res.json({ data: await listOnboardingCases(raw as OnboardingStatus || undefined) });
}
