/**
 * GET /api/admin/trading/providers
 * List configured market-data provider config + health snapshots
 * (the fallback chain tradingStore's live-price stubs will eventually read
 * from, once wired to real providers).
 */
import type { Request, Response } from 'express';
import { getProviders } from '../../../../lib/tradingAdminStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    return res.json({ ok: true, providers: getProviders() });
  } catch (err) {
    console.error('[admin/trading/providers GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load providers' });
  }
}
