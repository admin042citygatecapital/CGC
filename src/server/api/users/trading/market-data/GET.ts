/**
 * GET /api/users/trading/market-data
 * Query: symbols (comma-separated, e.g. "BTC/USD,ETH/USD") — defaults to
 *        every active market.
 *
 * Live price/24h-change/24h-volume/candles are genuine stubs in
 * tradingStore.ts (getLivePrice/get24hChange/get24hVolume/getCandles all
 * return 0/[] — "market data is fetched from external providers, not
 * stored in DB", per that file's own comment) — there's no real market
 * data feed wired up anywhere (entry.ts's marketRegistry/initMarketProviders
 * import from src/server/lib/market/{init,registry}.ts, which don't exist
 * in this repo yet). This returns those stub values honestly rather than
 * fabricating plausible-looking prices.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getMarkets } from '../../../../lib/tradingAdminStore.js';
import { getLivePrice, get24hChange, get24hVolume } from '../../../../lib/tradingStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const markets = getMarkets().filter(m => m.status === 'active');
  const requested = typeof req.query.symbols === 'string'
    ? req.query.symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    : null;

  const selected = requested
    ? markets.filter(m => requested.includes(m.symbol.toUpperCase()))
    : markets;

  const data = selected.map(m => ({
    symbol: m.symbol,
    name: m.name,
    assetClass: m.assetClass,
    price: getLivePrice(m.symbol),
    change24h: get24hChange(m.symbol),
    volume24h: get24hVolume(m.symbol),
    spreadBps: m.spreadBps,
  }));

  return res.json({ ok: true, data, live: false });
}
