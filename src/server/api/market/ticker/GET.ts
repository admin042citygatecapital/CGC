/**
 * GET /api/market/ticker?symbols=BTCUSDT,ETHUSDT&assetClass=crypto
 * Returns live ticker data for one or more symbols.
 */
import type { Request, Response } from 'express';
import { marketRegistry } from '../../../lib/market/registry.js';
import type { AssetClass } from '../../../lib/market/types.js';

export default async function handler(req: Request, res: Response) {
  const raw = String(req.query.symbols ?? '');
  if (!raw) { res.status(400).json({ error: 'symbols query param required' }); return; }

  const symbols    = raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const assetClass = req.query.assetClass as AssetClass | undefined;

  try {
    const tickers = await marketRegistry.getTicker(symbols, assetClass);
    res.json({ tickers, timestamp: Date.now() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch ticker';
    res.status(503).json({ error: msg });
  }
}
