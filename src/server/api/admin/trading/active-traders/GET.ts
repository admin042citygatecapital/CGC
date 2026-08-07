import type { Request, Response } from 'express';
import { getAllPositions, getAllOrders, getAllTrades } from '../../../../lib/tradingStore.js';
import { loadAllUsers } from '../../../../lib/userStore.js';

export default async (_req: Request, res: Response) => {
  try {
    const [positions, orders, trades, users] = await Promise.all([
      getAllPositions(),
      getAllOrders(),
      getAllTrades(),
      loadAllUsers(),
    ]);

    const userMap = new Map(users.map(u => [u.id, u]));

    // Build per-user stats
    const statsMap = new Map<string, {
      userId: string; email: string; name: string; tier: string;
      openPositions: number; openOrders: number; totalTrades: number;
      totalVolume: number; unrealisedPnl: number; realisedPnl: number;
      lastActivity: string;
    }>();

    for (const p of positions) {
      if (!statsMap.has(p.userId)) {
        const u = userMap.get(p.userId);
        statsMap.set(p.userId, {
          userId: p.userId,
          email: u?.email ?? 'Unknown',
          name: u?.name ?? 'Unknown',
          tier: u?.accountTier ?? 'personal',
          openPositions: 0, openOrders: 0, totalTrades: 0,
          totalVolume: 0, unrealisedPnl: 0, realisedPnl: 0,
          lastActivity: p.openedAt,
        });
      }
      const s = statsMap.get(p.userId)!;
      if (p.status === 'open') {
        s.openPositions++;
        s.unrealisedPnl += p.unrealisedPnl;
      } else {
        s.realisedPnl += p.realisedPnl;
      }
      if (p.openedAt > s.lastActivity) s.lastActivity = p.openedAt;
    }

    for (const o of orders) {
      if (['pending', 'open'].includes(o.status)) {
        if (!statsMap.has(o.userId)) {
          const u = userMap.get(o.userId);
          statsMap.set(o.userId, {
            userId: o.userId,
            email: u?.email ?? 'Unknown',
            name: u?.name ?? 'Unknown',
            tier: u?.accountTier ?? 'personal',
            openPositions: 0, openOrders: 0, totalTrades: 0,
            totalVolume: 0, unrealisedPnl: 0, realisedPnl: 0,
            lastActivity: o.createdAt,
          });
        }
        statsMap.get(o.userId)!.openOrders++;
      }
    }

    for (const t of trades) {
      if (!statsMap.has(t.userId)) {
        const u = userMap.get(t.userId);
        statsMap.set(t.userId, {
          userId: t.userId,
          email: u?.email ?? 'Unknown',
          name: u?.name ?? 'Unknown',
          tier: u?.accountTier ?? 'personal',
          openPositions: 0, openOrders: 0, totalTrades: 0,
          totalVolume: 0, unrealisedPnl: 0, realisedPnl: 0,
          lastActivity: t.executedAt,
        });
      }
      const s = statsMap.get(t.userId)!;
      s.totalTrades++;
      s.totalVolume += t.price * t.quantity;
      if (t.executedAt > s.lastActivity) s.lastActivity = t.executedAt;
    }

    const traders = [...statsMap.values()]
      .sort((a, b) => b.totalVolume - a.totalVolume);

    res.json({ traders, total: traders.length });
  } catch (err) {
    console.error('[admin/trading/active-traders GET]', err);
    res.status(500).json({ error: 'Failed to load active traders' });
  }
};
