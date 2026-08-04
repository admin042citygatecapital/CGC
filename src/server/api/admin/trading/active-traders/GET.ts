/**
 * GET /api/admin/trading/active-traders
 * Query: sort ('volume'|'trades'|'pnl'|'recent', default 'volume'), page, limit
 * Per-user trading activity summary, aggregated from all trades/positions
 * platform-wide (tradingStore has no admin "active traders" concept of its
 * own — this derives it from getAllTrades/getAllPositions).
 */
import type { Request, Response } from 'express';
import { getAllTrades, getAllPositions } from '../../../../lib/tradingStore.js';
import { findUserById } from '../../../../lib/userStore.js';
import { isOneOf } from '../../../../lib/inputValidator.js';

const SORTS = ['volume', 'trades', 'pnl', 'recent'] as const;

interface TraderSummary {
  userId: string;
  name?: string;
  email?: string;
  tradeCount: number;
  volume: number;
  pnl: number;
  openPositions: number;
  lastTradeAt: string;
}

export default async function handler(req: Request, res: Response) {
  try {
    const q = req.query as Record<string, string | undefined>;
    const sort = isOneOf(q.sort, SORTS) ?? 'volume';
    const page = q.page ? Math.max(1, parseInt(q.page, 10) || 1) : 1;
    const limit = q.limit ? Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20)) : 20;

    const [trades, positions] = await Promise.all([getAllTrades(), getAllPositions()]);

    const byUser = new Map<string, TraderSummary>();
    for (const t of trades) {
      let s = byUser.get(t.userId);
      if (!s) {
        s = { userId: t.userId, tradeCount: 0, volume: 0, pnl: 0, openPositions: 0, lastTradeAt: t.executedAt };
        byUser.set(t.userId, s);
      }
      s.tradeCount += 1;
      s.volume += t.price * t.quantity;
      s.pnl += t.pnl ?? 0;
      if (t.executedAt > s.lastTradeAt) s.lastTradeAt = t.executedAt;
    }
    for (const p of positions) {
      if (p.status !== 'open') continue;
      const s = byUser.get(p.userId);
      if (s) s.openPositions += 1;
    }

    const traders = Array.from(byUser.values());
    for (const t of traders) {
      const user = await findUserById(t.userId);
      if (user) { t.name = user.name; t.email = user.email; }
    }

    traders.sort((a, b) => {
      switch (sort) {
        case 'trades': return b.tradeCount - a.tradeCount;
        case 'pnl': return b.pnl - a.pnl;
        case 'recent': return b.lastTradeAt.localeCompare(a.lastTradeAt);
        default: return b.volume - a.volume;
      }
    });

    const total = traders.length;
    const data = traders.slice((page - 1) * limit, page * limit);

    return res.json({ ok: true, data, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    console.error('[admin/trading/active-traders] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load active traders' });
  }
}
