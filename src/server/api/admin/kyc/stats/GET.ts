/**
 * GET /api/admin/kyc/stats
 */
import type { Request, Response } from 'express';
import { getKycStats } from '../../../../lib/kycStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    return res.json({ ok: true, stats: await getKycStats() });
  } catch (err) {
    console.error('[admin/kyc/stats GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load KYC stats' });
  }
}
