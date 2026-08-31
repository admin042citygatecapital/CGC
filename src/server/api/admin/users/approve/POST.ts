import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { authorizeRecentAdminStepUp } from '../../../../lib/rbacMiddleware.js';
import { sanitizeNote } from '../../../../lib/inputValidator.js';
import { getLatestOnboardingCaseForUser } from '../../../../lib/onboardingStore.js';
import { activateCustomerAfterKyc } from '../../../../lib/finalCustomerActivation.js';
import { sendFinalActivationEmail } from '../../../../lib/emailService.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  if (session.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Only SUPER_ADMIN may provide final activation.', code: 'SUPER_ADMIN_REQUIRED' });
  if (!authorizeRecentAdminStepUp(req, res)) return;
  const userId = String(req.body?.userId ?? '');
  const reason = sanitizeNote(req.body?.reason ?? '').slice(0, 1000);
  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (reason.length < 10) return res.status(400).json({ error: 'A written activation rationale of at least 10 characters is required.' });
  const onboardingCase = await getLatestOnboardingCaseForUser(userId);
  if (!onboardingCase) return res.status(409).json({ error: 'An approved onboarding case is required.', code: 'ONBOARDING_CASE_REQUIRED' });
  try {
    const result = await activateCustomerAfterKyc({
      userId, caseId: onboardingCase.id, caseType: onboardingCase.caseType, expectedCaseVersion: Number(req.body?.expectedCaseVersion ?? onboardingCase.version),
      adminId: session.adminId, adminEmail: session.email, adminRole: session.role, reason,
      requestId: String(req.headers['x-request-id'] ?? '') || crypto.randomUUID(), ip: req.ip,
    });
    await sendFinalActivationEmail(result.customer.email, result.customer.name);
    return res.json({ ok: true, message: 'Customer activated. Restricted sessions were revoked; a fresh login is required.', revokedSessionCount: result.revokedSessionCount });
  } catch (error) {
    const typed = error as Error & { code?: string };
    const status = typed.code === 'NOT_FOUND' ? 404 : 409;
    return res.status(status).json({ error: typed.message, code: typed.code });
  }
}
