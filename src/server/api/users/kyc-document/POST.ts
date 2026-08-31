import type { Request, Response } from 'express';
export default function handler(_req: Request, res: Response) {
  return res.status(410).json({
    error: 'This legacy upload route is retired. Use the secure identity onboarding workflow.',
    code: 'KYC_WORKFLOW_REQUIRED',
    href: '/kyc',
  });
}
