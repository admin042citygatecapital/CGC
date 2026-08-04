/**
 * GET /api/admin/trading/freeze
 * Current global trading-freeze state plus the freeze/unfreeze event log.
 */
import type { Request, Response } from 'express';
import { isTradingFrozen, getFreezeEvents } from '../../../../lib/tradingAdminStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    const events = getFreezeEvents();
    return res.json({
      ok: true,
      frozen: isTradingFrozen(),
      events: events.slice(-100).reverse(),
    });
  } catch (err) {
    console.error('[admin/trading/freeze GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load freeze status' });
  }
}
