import type { Request, Response } from 'express';
import {
  suspendMarket, resumeMarket, appendFreezeEvent, appendTradingLog,
} from '../../../../../lib/tradingAdminStore.js';

export default async (req: Request, res: Response) => {
  try {
    const { marketId, action, reason } = req.body as {
      marketId: string;
      action: 'suspend' | 'resume';
      reason?: string;
    };

    if (!marketId || !action) return res.status(400).json({ error: 'marketId and action required' });

    const session = req.adminSession;
    const adminId    = session?.email ?? 'admin';
    const adminEmail = session?.email ?? 'admin';

    let market;
    if (action === 'suspend') {
      market = suspendMarket(marketId, reason ?? 'Admin action', adminId);
      if (!market) return res.status(404).json({ error: 'Market not found' });

      appendFreezeEvent({ type: 'suspend_market', targetSymbol: market.symbol, reason: reason ?? 'Admin action', adminId, adminEmail });
      appendTradingLog({ action: 'suspend_market', category: 'freeze', targetId: marketId, targetLabel: market.symbol, details: `Suspended market ${market.symbol}: ${reason ?? 'No reason given'}`, adminId, adminEmail, ip: req.ip });
    } else {
      market = resumeMarket(marketId);
      if (!market) return res.status(404).json({ error: 'Market not found' });

      appendFreezeEvent({ type: 'resume_market', targetSymbol: market.symbol, reason: reason ?? 'Admin action', adminId, adminEmail });
      appendTradingLog({ action: 'resume_market', category: 'freeze', targetId: marketId, targetLabel: market.symbol, details: `Resumed market ${market.symbol}`, adminId, adminEmail, ip: req.ip });
    }

    res.json({ market });
  } catch (err) {
    console.error('[admin/trading/markets/suspend POST]', err);
    res.status(500).json({ error: 'Failed to update market status' });
  }
};
