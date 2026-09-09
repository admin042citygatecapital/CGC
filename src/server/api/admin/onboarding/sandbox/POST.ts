import type { Request, Response } from 'express';
import { authorizeAdminRole } from '../../../../lib/rbacMiddleware.js';
import { createSandboxTest } from '../../../../lib/sumsubSandbox.js';
import { OnboardingProviderError } from '../../../../lib/onboardingProviderWebhook.js';

export default async function handler(req: Request, res: Response) {
  if (!authorizeAdminRole(req, res, 'SUPER_ADMIN')) return;
  res.set('Cache-Control', 'no-store');
  try { return res.json(await createSandboxTest(String(req.body?.requestId ?? ''), req.adminSession!.adminId)); }
  catch (error) {
    if (error instanceof OnboardingProviderError) return res.status(error.status).json({ error: error.message, code: error.code });
    return res.status(503).json({ error: 'Sandbox storage unavailable. Apply migration 0057 and check database connectivity.', code: 'SANDBOX_STORAGE_UNAVAILABLE' });
  }
}
