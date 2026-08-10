import type { Request, Response } from 'express';
import { getFees } from '../../../../lib/tradingAdminStore.js';
import { isPreviewMode } from '../../../../lib/platformMode.js';

export default async (_req: Request, res: Response) => {
  try {
    res.json({ fees: getFees(), dataClassification: isPreviewMode ? 'fee_planning_records' : 'fee_configuration' });
  } catch (err) {
    console.error('[admin/trading/fees GET]', err);
    res.status(500).json({ error: 'Failed to load fees' });
  }
};
