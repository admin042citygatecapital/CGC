import type { Request, Response } from 'express';
import { getMarkets } from '../../../../lib/tradingAdminStore.js';
import { isPreviewMode } from '../../../../lib/platformMode.js';

export default async (_req: Request, res: Response) => {
  try {
    const markets = getMarkets().map(market => isPreviewMode ? { ...market, status: 'disabled' as const } : market);
    res.json({ markets, dataClassification: isPreviewMode ? 'market_planning_records' : 'market_configuration' });
  } catch (err) {
    console.error('[admin/trading/markets GET]', err);
    res.status(500).json({ error: 'Failed to load markets' });
  }
};
