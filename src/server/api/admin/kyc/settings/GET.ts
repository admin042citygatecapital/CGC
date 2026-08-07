/**
 * GET /api/admin/kyc/settings
 */
import type { Request, Response } from 'express';
import { readKycSettings } from '../../../../lib/kycStore.js';

export default function handler(_req: Request, res: Response) {
  return res.json(readKycSettings());
}
