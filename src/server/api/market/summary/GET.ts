/**
 * GET /api/market/summary?assetClass=crypto
 * Returns gainers, losers, trending, mostActive
 */
import type { Request, Response } from 'express';
import { marketRegistry } from '../../../lib/market/registry.js';
import type { AssetClass } from '../../../lib/market/types.js';

export default async function handler(req: Request, res: Response) {
  const assetClass = (req.query.assetClass ?? 'crypto') as AssetClass;

  try {
    const summary = await marketRegistry.getMarketSummary(assetClass);
    res.json({ ...summary, timestamp: Date.now() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch market summary';
    res.status(503).json({ error: msg });
  }
}
