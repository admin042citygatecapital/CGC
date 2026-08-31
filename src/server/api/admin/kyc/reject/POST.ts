import type { Request, Response } from 'express';
import { authorizeRecentAdminStepUp } from '../../../../lib/rbacMiddleware.js';
import { getLatestOnboardingCaseForUser } from '../../../../lib/onboardingStore.js';
import { decideKycCase } from '../../../../lib/kycReviewService.js';
export default async function handler(req: Request, res: Response) {
  if (!authorizeRecentAdminStepUp(req, res)) return;
  const session = req.adminSession!;
  const record = req.body?.userId ? await getLatestOnboardingCaseForUser(String(req.body.userId)) : null;
  if (!record) return res.status(409).json({ error: 'A submitted onboarding case is required.', code: 'ONBOARDING_CASE_REQUIRED' });
  try {
    const result = await decideKycCase({ caseId: record.id, decision: 'rejected', reason: String(req.body?.reason ?? ''), reasonCode: String(req.body?.reasonCode ?? 'other'), requestedEvidenceKinds: [], expectedVersion: Number(req.body?.expectedVersion), adminId: session.adminId, adminEmail: session.email, adminRole: session.role, ip: req.ip, requestId: String(req.headers['x-request-id'] ?? '') });
    return res.json({ ok: true, case: result.case });
  } catch (error) { const typed = error as Error & { code?: string }; return res.status(typed.code === 'NOT_FOUND' ? 404 : typed.code?.includes('PROVIDER') || typed.code?.includes('CONFLICT') ? 409 : 400).json({ error: typed.message, code: typed.code }); }
}
