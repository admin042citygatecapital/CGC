import type { Request, Response } from 'express';
import { isTradingFrozen, getFreezeEvents } from '../../../../lib/tradingAdminStore.js';

export default async (_req: Request, res: Response) => {
  try {
    const frozen = isTradingFrozen();
    const events = getFreezeEvents().slice(-50).reverse();
    res.json({ frozen, events });
  } catch (err) {
    console.error('[admin/trading/freeze GET]', err);
    res.status(500).json({ error: 'Failed to load freeze state' });
  }
};
