/**
 * GET /api/admin/trading
 * Trading administration overview: market/provider/fee-tier counts by
 * status, global freeze state, platform-wide position/order/trade totals,
 * and the most recent admin trading actions.
 */
import type { Request, Response } from 'express';
import {
  getMarkets, getFees, getProviders, isTradingFrozen, getTradingLogs,
} from '../../../lib/tradingAdminStore.js';
import { getAllPositions, getAllOrders, getAllTrades } from '../../../lib/tradingStore.js';

function tally<T extends string>(items: { status: T }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) out[i.status] = (out[i.status] ?? 0) + 1;
  return out;
}

export default async function handler(_req: Request, res: Response) {
  try {
    const markets = getMarkets();
    const fees = getFees();
    const providers = getProviders();

    const [positions, orders, trades] = await Promise.all([
      getAllPositions(),
      getAllOrders(),
      getAllTrades(),
    ]);

    const openPositions = positions.filter(p => p.status === 'open');
    const totalVolume = trades.reduce((s, t) => s + t.price * t.quantity, 0);
    const totalPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);

    return res.json({
      ok: true,
      frozen: isTradingFrozen(),
      markets: { total: markets.length, byStatus: tally(markets) },
      fees: { total: fees.length },
      providers: { total: providers.length, byStatus: tally(providers) },
      activity: {
        openPositions: openPositions.length,
        totalOrders: orders.length,
        totalTrades: trades.length,
        totalVolume,
        totalPnl,
      },
      recentLogs: getTradingLogs(20),
    });
  } catch (err) {
    console.error('[admin/trading] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load trading overview' });
  }
}
