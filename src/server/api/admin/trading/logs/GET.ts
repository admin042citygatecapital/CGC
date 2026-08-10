import type { Request, Response } from 'express';
import { getTradingLogs, type TradingLog } from '../../../../lib/tradingAdminStore.js';

const CATEGORIES = new Set<TradingLog['category']>([
  'market', 'fee', 'provider', 'freeze', 'account', 'config',
]);

function boundedLimit(value: unknown): number {
  const parsed = Number(value ?? 200);
  if (!Number.isFinite(parsed)) return 200;
  return Math.min(500, Math.max(1, Math.trunc(parsed)));
}

export default function handler(req: Request, res: Response) {
  try {
    const limit = boundedLimit(req.query.limit);
    const categoryValue = req.query.category ? String(req.query.category) : undefined;
    if (categoryValue && !CATEGORIES.has(categoryValue as TradingLog['category'])) {
      return res.status(400).json({ error: 'Invalid trading log category' });
    }

    const allLogs = getTradingLogs(500);
    const filtered = categoryValue
      ? allLogs.filter(log => log.category === categoryValue)
      : allLogs;

    return res.json({
      logs: filtered.slice(0, limit),
      total: filtered.length,
      dataClassification: 'deferred_trading_admin_audit',
    });
  } catch (error) {
    console.error('[admin/trading/logs GET]', error);
    return res.status(500).json({ error: 'Failed to load trading administration logs' });
  }
}
