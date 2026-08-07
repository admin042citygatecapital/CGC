import type { Request, Response } from 'express';
import { getMarket, upsertMarket, appendTradingLog } from '../../../../lib/tradingAdminStore.js';

export default async (req: Request, res: Response) => {
  try {
    const market = req.body;
    if (!market?.id) return res.status(400).json({ error: 'Market id required' });

    const existing = getMarket(market.id);
    if (!existing) return res.status(404).json({ error: 'Market not found' });

    const updated = { ...existing, ...market, updatedAt: new Date().toISOString() };
    upsertMarket(updated);

    const session = req.adminSession;
    appendTradingLog({
      action: 'update_market',
      category: 'market',
      targetId: market.id,
      targetLabel: market.symbol ?? existing.symbol,
      details: `Updated market config for ${market.symbol ?? existing.symbol}`,
      adminId: session?.email ?? 'admin',
      adminEmail: session?.email ?? 'admin',
      ip: req.ip,
    });

    res.json({ market: updated });
  } catch (err) {
    console.error('[admin/trading/markets PUT]', err);
    res.status(500).json({ error: 'Failed to update market' });
  }
};
