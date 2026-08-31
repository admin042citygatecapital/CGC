import type { Request, Response } from 'express';
import { createNotification } from '../../../../lib/notificationStore.js';
import { getOrCreateOnboardingCase, submitOnboardingCase } from '../../../../lib/onboardingStore.js';
import { sendKycSubmittedEmail } from '../../../../lib/emailService.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser!;
  try {
    const record = await getOrCreateOnboardingCase(user.id, user.accountTier === 'business' ? 'business' : 'individual', user.id);
    const submitted = await submitOnboardingCase(
      record.id,
      user.id,
      user.id,
      'customer',
      Number(req.body?.caseVersion),
      String(req.body?.idempotencyKey ?? ''),
    );
    if (!submitted.submissionReplayed) {
      await createNotification(user.id, 'Onboarding submitted', 'Your onboarding case has been submitted for identity and compliance review. This does not activate financial services.', '/kyc');
      await sendKycSubmittedEmail(user.email, user.name);
    }
    return res.json({ ok: true, case: submitted });
  } catch (error) {
    const typed = error as Error & { code?: string };
    return res.status(typed.code === 'NOT_FOUND' ? 404 : 409).json({ error: typed.message, code: typed.code });
  }
}
