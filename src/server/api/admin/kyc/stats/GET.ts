/**
 * GET /api/admin/kyc/stats
 * Returns KYC dashboard statistics.
 */
import type { Request, Response } from 'express';
import { getKycStats } from '../../../../lib/kycStore.js';

export default function handler(_req: Request, res: Response) {
  return res.json(getKycStats());
}
