import type { Request, Response } from 'express';
import { getOnboardingCaseBundle, getOrCreateOnboardingCase } from '../../../lib/onboardingStore.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser!;
  const caseType = user.accountTier === 'business' ? 'business' : 'individual';
  const record = await getOrCreateOnboardingCase(user.id, caseType, user.id);
  const bundle = await getOnboardingCaseBundle(record.id);
  return res.json(bundle);
}
