/**
 * GET /api/users/trading/analytics
 * Portfolio analytics: P&L breakdown, win rate, asset distribution,
 * daily P&L history, best/worst trades, streak stats.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getTrades, getPositions } from '../../../../lib/tradingStore.js';

export default async (req: Request, res: Response) => {
  try {
    const auth  = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const user = await findUserBySessionToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

    const [trades, positions] = await Promise.all([
      getTrades(user.id),
      getPositions(user.id),
    ]);

    // ── Win / Loss stats ──────────────────────────────────────────────────────
    const closedTrades = trades.filter(t => t.pnl !== undefined);
    const winners = closedTrades.filter(t => (t.pnl ?? 0) > 0);
    const losers  = closedTrades.filter(t => (t.pnl ?? 0) < 0);
    const winRate = closedTrades.length > 0
      ? parseFloat(((winners.length / closedTrades.length) * 100).toFixed(1))
      : 0;

    const totalProfit = winners.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const totalLoss   = Math.abs(losers.reduce((s, t) => s + (t.pnl ?? 0), 0));
    const profitFactor = totalLoss > 0 ? parseFloat((totalProfit / totalLoss).toFixed(2)) : null;

    const avgWin  = winners.length > 0 ? parseFloat((totalProfit / winners.length).toFixed(2)) : 0;
    const avgLoss = losers.length  > 0 ? parseFloat((totalLoss  / losers.length).toFixed(2))  : 0;

    // ── Best / Worst trades ───────────────────────────────────────────────────
    const sorted = [...closedTrades].sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0));
    const bestTrade  = sorted[0]  ?? null;
    const worstTrade = sorted[sorted.length - 1] ?? null;

    // ── Win streak ────────────────────────────────────────────────────────────
    const byTime = [...closedTrades].sort(
      (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime()
    );
    let currentStreak = 0; let maxStreak = 0; let streak = 0;
    for (const t of byTime) {
      if ((t.pnl ?? 0) > 0) { streak++; maxStreak = Math.max(maxStreak, streak); }
      else streak = 0;
    }
    // current streak from end
    for (let i = byTime.length - 1; i >= 0; i--) {
      if ((byTime[i].pnl ?? 0) > 0) currentStreak++;
      else break;
    }

    // ── Daily P&L history (last 30 days) ─────────────────────────────────────
    const now = new Date();
    const dailyMap: Record<string, number> = {};
    for (let d = 29; d >= 0; d--) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - d);
      dailyMap[dt.toISOString().slice(0, 10)] = 0;
    }
    for (const t of closedTrades) {
      const day = t.executedAt.slice(0, 10);
      if (day in dailyMap) dailyMap[day] += t.pnl ?? 0;
    }
    const dailyPnl = Object.entries(dailyMap).map(([date, pnl]) => ({
      date,
      pnl: parseFloat(pnl.toFixed(2)),
    }));

    // ── Asset class breakdown ─────────────────────────────────────────────────
    const assetMap: Record<string, { trades: number; pnl: number; volume: number }> = {};
    for (const t of closedTrades) {
      const cls = t.assetClass;
      if (!assetMap[cls]) assetMap[cls] = { trades: 0, pnl: 0, volume: 0 };
      assetMap[cls].trades++;
      assetMap[cls].pnl    += t.pnl ?? 0;
      assetMap[cls].volume += t.price * t.quantity;
    }
    const assetBreakdown = Object.entries(assetMap).map(([assetClass, v]) => ({
      assetClass,
      trades:   v.trades,
      pnl:      parseFloat(v.pnl.toFixed(2)),
      volume:   parseFloat(v.volume.toFixed(2)),
      winRate:  0, // computed below
    }));

    // ── Symbol breakdown (top 10 by volume) ──────────────────────────────────
    const symbolMap: Record<string, { trades: number; pnl: number; volume: number; wins: number }> = {};
    for (const t of closedTrades) {
      if (!symbolMap[t.symbol]) symbolMap[t.symbol] = { trades: 0, pnl: 0, volume: 0, wins: 0 };
      symbolMap[t.symbol].trades++;
      symbolMap[t.symbol].pnl    += t.pnl ?? 0;
      symbolMap[t.symbol].volume += t.price * t.quantity;
      if ((t.pnl ?? 0) > 0) symbolMap[t.symbol].wins++;
    }
    const symbolBreakdown = Object.entries(symbolMap)
      .map(([symbol, v]) => ({
        symbol,
        trades:  v.trades,
        pnl:     parseFloat(v.pnl.toFixed(2)),
        volume:  parseFloat(v.volume.toFixed(2)),
        winRate: v.trades > 0 ? parseFloat(((v.wins / v.trades) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);

    // ── Open positions summary ────────────────────────────────────────────────
    const openPositions = positions.filter(p => p.status === 'open');
    const unrealisedPnl = openPositions.reduce((s, p) => s + p.unrealisedPnl, 0);

    res.json({
      summary: {
        totalTrades:   closedTrades.length,
        openPositions: openPositions.length,
        winRate,
        profitFactor,
        avgWin,
        avgLoss,
        totalProfit:   parseFloat(totalProfit.toFixed(2)),
        totalLoss:     parseFloat(totalLoss.toFixed(2)),
        netPnl:        parseFloat((totalProfit - totalLoss).toFixed(2)),
        unrealisedPnl: parseFloat(unrealisedPnl.toFixed(2)),
        maxWinStreak:  maxStreak,
        currentStreak,
        bestTrade:  bestTrade  ? { symbol: bestTrade.symbol,  pnl: bestTrade.pnl,  executedAt: bestTrade.executedAt }  : null,
        worstTrade: worstTrade ? { symbol: worstTrade.symbol, pnl: worstTrade.pnl, executedAt: worstTrade.executedAt } : null,
      },
      dailyPnl,
      assetBreakdown,
      symbolBreakdown,
      recentTrades: [...closedTrades]
        .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
        .slice(0, 50)
        .map(t => ({
          id: t.id, symbol: t.symbol, assetClass: t.assetClass,
          side: t.side, quantity: t.quantity, price: t.price,
          pnl: t.pnl ?? 0, fee: t.fee, executedAt: t.executedAt,
        })),
    });
  } catch (err) {
    console.error('[trading/analytics GET]', err);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
};
