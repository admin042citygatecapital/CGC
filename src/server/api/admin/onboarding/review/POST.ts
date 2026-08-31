import type { Request, Response } from 'express';
import { authorizeRecentAdminStepUp } from '../../../../lib/rbacMiddleware.js';
import { decideKycCase } from '../../../../lib/kycReviewService.js';
import type { OnboardingStatus } from '../../../../lib/onboardingStore.js';

export default async function handler(req: Request, res: Response) {
  if (!authorizeRecentAdminStepUp(req, res)) return;
  const session = req.adminSession!;
  try {
    const result = await decideKycCase({
      caseId: String(req.body?.caseId ?? ''),
      decision: String(req.body?.decision ?? '') as OnboardingStatus,
      reason: String(req.body?.reason ?? ''),
      reasonCode: String(req.body?.reasonCode ?? 'other'),
      requestedEvidenceKinds: Array.isArray(req.body?.requestedEvidenceKinds) ? req.body.requestedEvidenceKinds : [],
      expectedVersion: Number(req.body?.expectedVersion),
      adminId: session.adminId,
      adminEmail: session.email,
      adminRole: session.role,
      ip: req.ip,
      requestId: String(req.headers['x-request-id'] ?? ''),
    });
    return res.json({ ok: true, case: result.case });
  } catch (error) {
    const typed = error as Error & { code?: string };
    const conflicts = ['PROVIDER_VERIFICATION_REQUIRED', 'MAKER_CHECKER_REQUIRED', 'WORKFLOW_CONFLICT', 'INVALID_TRANSITION'];
    const status = typed.code === 'NOT_FOUND' ? 404 : conflicts.includes(typed.code ?? '') ? 409 : 400;
    return res.status(status).json({ error: typed.message, code: typed.code });
  }
}
