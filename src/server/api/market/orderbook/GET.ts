/**
 * GET /api/market/orderbook?symbol=BTCUSDT&depth=20&assetClass=crypto
 */
import type { Request, Response } from 'express';
import { marketRegistry } from '../../../lib/market/registry.js';
import type { AssetClass } from '../../../lib/market/types.js';

export default async function handler(req: Request, res: Response) {
  const symbol     = String(req.query.symbol ?? '').toUpperCase();
  const depth      = Math.min(parseInt(String(req.query.depth ?? '20'), 10), 100);
  const assetClass = req.query.assetClass as AssetClass | undefined;

  if (!symbol) { res.status(400).json({ error: 'symbol required' }); return; }

  try {
    const orderBook = await marketRegistry.getOrderBook(symbol, depth, assetClass);
    res.json(orderBook);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch order book';
    res.status(503).json({ error: msg });
  }
}
