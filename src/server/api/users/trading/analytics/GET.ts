/**
 * GET /api/users/trading/analytics
 * Breaks the customer's trade history down by symbol and asset class —
 * there's no dedicated analytics store, so this aggregates
 * tradingStore.getTrades the same way admin/trading's active-traders
 * route aggregates platform-wide activity.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getTrades } from '../../../../lib/tradingStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const trades = await getTrades(user.id);

  const bySymbol: Record<string, { trades: number; volume: number; pnl: number }> = {};
  const byAssetClass: Record<string, { trades: number; volume: number; pnl: number }> = {};
  let totalVolume = 0;
  let totalPnl = 0;
  let wins = 0;

  for (const t of trades) {
    const volume = t.price * t.quantity;
    totalVolume += volume;
    totalPnl += t.pnl ?? 0;
    if ((t.pnl ?? 0) > 0) wins += 1;

    const s = (bySymbol[t.symbol] ??= { trades: 0, volume: 0, pnl: 0 });
    s.trades += 1; s.volume += volume; s.pnl += t.pnl ?? 0;

    const a = (byAssetClass[t.assetClass] ??= { trades: 0, volume: 0, pnl: 0 });
    a.trades += 1; a.volume += volume; a.pnl += t.pnl ?? 0;
  }

  return res.json({
    ok: true,
    totalTrades: trades.length,
    totalVolume,
    totalPnl,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    bySymbol,
    byAssetClass,
  });
}
