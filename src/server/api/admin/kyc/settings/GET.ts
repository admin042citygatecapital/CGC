/**
 * GET /api/admin/kyc/settings
 */
import type { Request, Response } from 'express';
import { readKycSettings } from '../../../../lib/kycStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    return res.json({ ok: true, settings: await readKycSettings() });
  } catch (err) {
    console.error('[admin/kyc/settings GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load KYC settings' });
  }
}
