import type { Request, Response } from 'express';
import {
  getAllPositions, getAllOrders, getAllTrades, getMarketData,
} from '../../../lib/tradingStore.js';

export default async (_req: Request, res: Response) => {
  try {
    const [positions, orders, trades] = await Promise.all([
      getAllPositions(),
      getAllOrders(),
      getAllTrades(),
    ]);
    const markets   = getMarketData();

    const openPositions   = positions.filter(p => p.status === 'open');
    const closedPositions = positions.filter(p => p.status === 'closed');
    const openOrders      = orders.filter(o => ['pending', 'open'].includes(o.status));
    const filledOrders    = orders.filter(o => o.status === 'filled');

    const totalUnrealisedPnl = openPositions.reduce((s, p) => s + p.unrealisedPnl, 0);
    const totalRealisedPnl   = closedPositions.reduce((s, p) => s + p.realisedPnl, 0);
    const totalVolume        = trades.reduce((s, t) => s + t.price * t.quantity, 0);
    const totalFees          = trades.reduce((s, t) => s + t.fee, 0);

    // Risk flags: positions with unrealised loss > 20% of cost
    const riskFlags = openPositions.filter(p => {
      const cost = p.avgEntryPrice * p.quantity;
      return cost > 0 && (p.unrealisedPnl / cost) < -0.20;
    });

    // Top symbols by open interest
    const symbolMap: Record<string, number> = {};
    for (const p of openPositions) {
      symbolMap[p.symbol] = (symbolMap[p.symbol] ?? 0) + p.quantity * p.currentPrice;
    }
    const topSymbols = Object.entries(symbolMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symbol, value]) => ({ symbol, value: parseFloat(value.toFixed(2)) }));

    // Unique active traders
    const activeTraders = new Set(openPositions.map(p => p.userId)).size;

    res.json({
      summary: {
        openPositions:    openPositions.length,
        closedPositions:  closedPositions.length,
        openOrders:       openOrders.length,
        filledOrders:     filledOrders.length,
        totalTrades:      trades.length,
        activeTraders,
        totalUnrealisedPnl: parseFloat(totalUnrealisedPnl.toFixed(2)),
        totalRealisedPnl:   parseFloat(totalRealisedPnl.toFixed(2)),
        totalVolume:        parseFloat(totalVolume.toFixed(2)),
        totalFees:          parseFloat(totalFees.toFixed(2)),
        riskFlagCount:      riskFlags.length,
      },
      openPositions,
      openOrders,
      riskFlags,
      topSymbols,
      recentTrades: trades
        .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
        .slice(0, 50),
      markets: markets.slice(0, 12),
    });
  } catch (err) {
    console.error('[admin/trading GET]', err);
    res.status(500).json({ error: 'Failed to load trading data' });
  }
};
