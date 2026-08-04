/**
 * GET /api/admin/rates
 * Full rates/fees configuration (exchange rates, transfer fees,
 * per-transaction-type fees, FX markups, tier fees, withdrawal limits).
 */
import type { Request, Response } from 'express';
import { readRatesConfig } from '../../../lib/ratesStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    return res.json({ ok: true, config: readRatesConfig() });
  } catch (err) {
    console.error('[admin/rates GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load rates config' });
  }
}
