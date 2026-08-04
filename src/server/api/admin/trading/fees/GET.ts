/**
 * GET /api/admin/trading/fees
 * List fee tiers (maker/taker rates by asset class and volume threshold).
 */
import type { Request, Response } from 'express';
import { getFees } from '../../../../lib/tradingAdminStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    return res.json({ ok: true, tiers: getFees() });
  } catch (err) {
    console.error('[admin/trading/fees GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load fee tiers' });
  }
}
