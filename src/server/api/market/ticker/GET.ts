/**
 * GET /api/market/ticker?symbols=BTCUSDT,ETHUSDT&assetClass=crypto
 * Returns live ticker data for one or more symbols.
 *
 * Input contract: symbols must be a comma-separated list of 1-20 char
 * [A-Z0-9._-] tokens (deduplicated, max 50); assetClass must be one of the
 * supported classes. `asOf` is the newest provider observation timestamp in
 * the payload — the honest freshness signal (the outer `timestamp` is only
 * response-construction time).
 */
import type { Request, Response } from 'express';
import { marketRegistry } from '../../../lib/market/registry.js';
import type { AssetClass } from '../../../lib/market/types.js';

const SUPPORTED_ASSET_CLASSES: ReadonlySet<string> = new Set(['crypto', 'stock', 'forex', 'commodity', 'etf']);
const SYMBOL_PATTERN    = /^[A-Z0-9._-]{1,20}$/;
const MAX_SYMBOLS       = 50;

export default async function handler(req: Request, res: Response) {
  const raw = String(req.query.symbols ?? '');
  const symbols = Array.from(new Set(
    raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
  ));

  if (!symbols.length) { res.status(400).json({ error: 'symbols query param required' }); return; }
  if (symbols.length > MAX_SYMBOLS) { res.status(400).json({ error: `at most ${MAX_SYMBOLS} symbols per request` }); return; }
  const invalid = symbols.filter(s => !SYMBOL_PATTERN.test(s));
  if (invalid.length) { res.status(400).json({ error: `invalid symbol format: ${invalid.slice(0, 5).join(', ')}` }); return; }

  const rawClass = typeof req.query.assetClass === 'string' ? req.query.assetClass.trim().toLowerCase() : undefined;
  if (rawClass !== undefined && rawClass !== '' && !SUPPORTED_ASSET_CLASSES.has(rawClass)) {
    res.status(400).json({ error: `unsupported assetClass: ${rawClass}` });
    return;
  }
  const assetClass = rawClass ? (rawClass as AssetClass) : undefined;

  try {
    const tickers = await marketRegistry.getTicker(symbols, assetClass);
    const asOf = tickers.length
      ? Math.max(...tickers.map(t => t.timestamp))
      : Date.now();
    res.json({ tickers, timestamp: Date.now(), asOf });
  } catch (err) {
    // Provider details stay in server logs; the public body is a stable code.
    console.error('market.ticker.error', { errorType: err instanceof Error ? err.name : 'UnknownError' });
    res.status(503).json({ error: 'TICKER_UNAVAILABLE' });
  }
}