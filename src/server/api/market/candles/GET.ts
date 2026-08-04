/**
 * GET /api/market/candles?symbol=BTCUSDT&interval=1h&limit=200&assetClass=crypto
 */
import type { Request, Response } from 'express';
import { marketRegistry } from '../../../lib/market/registry.js';
import type { AssetClass, CandleInterval } from '../../../lib/market/types.js';

export default async function handler(req: Request, res: Response) {
  const symbol     = String(req.query.symbol ?? '').toUpperCase();
  const interval   = (req.query.interval ?? '1h') as CandleInterval;
  const limit      = Math.min(parseInt(String(req.query.limit ?? '200'), 10), 1000);
  const assetClass = req.query.assetClass as AssetClass | undefined;

  if (!symbol) { res.status(400).json({ error: 'symbol required' }); return; }

  try {
    const candles = await marketRegistry.getCandles(symbol, interval, limit, assetClass);
    res.json({ symbol, interval, candles, timestamp: Date.now() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch candles';
    res.status(503).json({ error: msg });
  }
}
