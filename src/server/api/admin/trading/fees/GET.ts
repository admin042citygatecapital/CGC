import type { Request, Response } from 'express';
import { getFees } from '../../../../lib/tradingAdminStore.js';

export default async (_req: Request, res: Response) => {
  try {
    res.json({ fees: getFees() });
  } catch (err) {
    console.error('[admin/trading/fees GET]', err);
    res.status(500).json({ error: 'Failed to load fees' });
  }
};
