/**
 * GET /api/admin/trading/markets
 * List all configured markets (per-symbol enable/disable, spread, order
 * size limits, leverage, trading hours).
 */
import type { Request, Response } from 'express';
import { getMarkets } from '../../../../lib/tradingAdminStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    return res.json({ ok: true, markets: getMarkets() });
  } catch (err) {
    console.error('[admin/trading/markets GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load markets' });
  }
}
