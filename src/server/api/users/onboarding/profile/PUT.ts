import type { Request, Response } from 'express';
import { getOrCreateOnboardingCase } from '../../../../lib/onboardingStore.js';
import { saveKycProfile } from '../../../../lib/kycPrivateStore.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser!;
  try {
    const record = await getOrCreateOnboardingCase(user.id, user.accountTier === 'business' ? 'business' : 'individual', user.id);
    const profile = await saveKycProfile(user.id, record.id, req.body);
    return res.json({ ok: true, profile });
  } catch (error) {
    const typed = error as Error & { code?: string };
    const status = typed.code === 'NOT_FOUND' ? 404 : typed.code === 'CASE_LOCKED' ? 409 : typed.code?.endsWith('UNAVAILABLE') ? 503 : 400;
    return res.status(status).json({ error: typed.message, code: typed.code });
  }
}
