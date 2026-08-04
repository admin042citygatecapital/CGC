/**
 * GET /api/market/search?q=bitcoin
 */
import type { Request, Response } from 'express';
import { marketRegistry } from '../../../lib/market/registry.js';

export default async function handler(req: Request, res: Response) {
  const q = String(req.query.q ?? '').trim();
  if (!q) { res.status(400).json({ error: 'q query param required' }); return; }

  try {
    const results = await marketRegistry.search(q);
    res.json({ results, timestamp: Date.now() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Search failed';
    res.status(503).json({ error: msg });
  }
}
