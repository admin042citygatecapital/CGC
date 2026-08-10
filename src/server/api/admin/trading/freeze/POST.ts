import type { Request, Response } from 'express';
import { appendFreezeEvent, appendTradingLog } from '../../../../lib/tradingAdminStore.js';
import { requirePaperTrading } from '../../../../lib/platformMode.js';

export default async (req: Request, res: Response) => {
  try {
    const { action, reason } = req.body as { action: 'freeze' | 'unfreeze'; reason?: string };
    if (!action) return res.status(400).json({ error: 'action required (freeze | unfreeze)' });
    if (action === 'unfreeze' && !requirePaperTrading(res)) return;

    const session    = req.adminSession;
    const adminId    = session?.email ?? 'admin';
    const adminEmail = session?.email ?? 'admin';
    const type       = action === 'freeze' ? 'freeze_all' as const : 'unfreeze_all' as const;

    const event = appendFreezeEvent({ type, reason: reason ?? 'Admin action', adminId, adminEmail });
    appendTradingLog({
      action: type,
      category: 'freeze',
      details: `${action === 'freeze' ? 'FROZE' : 'UNFROZE'} all trading: ${reason ?? 'No reason given'}`,
      adminId,
      adminEmail,
      ip: req.ip,
    });

    res.json({ frozen: action === 'freeze', event });
  } catch (err) {
    console.error('[admin/trading/freeze POST]', err);
    res.status(500).json({ error: 'Failed to update freeze state' });
  }
};
