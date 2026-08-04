/**
 * GET /api/admin/settings/rates
 * The legacy/basic rates+fees pair (ExchangeRates + TransferFees) —
 * ratesStore.ts's own comment calls these "existing types (preserved for
 * backwards compat)", distinct from the newer per-transaction-type/tier/
 * FX-markup config surfaced at GET /api/admin/rates.
 */
import type { Request, Response } from 'express';
import { readRatesConfig } from '../../../../lib/ratesStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    const config = readRatesConfig();
    return res.json({ ok: true, rates: config.rates, fees: config.fees });
  } catch (err) {
    console.error('[admin/settings/rates GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load rates settings' });
  }
}
