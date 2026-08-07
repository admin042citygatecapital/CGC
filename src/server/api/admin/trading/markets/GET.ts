import type { Request, Response } from 'express';
import { getMarkets } from '../../../../lib/tradingAdminStore.js';

export default async (_req: Request, res: Response) => {
  try {
    res.json({ markets: getMarkets() });
  } catch (err) {
    console.error('[admin/trading/markets GET]', err);
    res.status(500).json({ error: 'Failed to load markets' });
  }
};
