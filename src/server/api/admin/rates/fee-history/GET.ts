/**
 * GET /api/admin/rates/fee-history
 * Query: limit (default 200), offset (default 0), format=csv
 */
import type { Request, Response } from 'express';
import { readFeeHistory, feeHistoryCsv } from '../../../../lib/ratesStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    if (req.query.format === 'csv') {
      const csv = feeHistoryCsv();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="fee-history-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(csv);
    }

    const limit = Math.min(1000, Math.max(1, parseInt(String(req.query.limit ?? '200'), 10) || 200));
    const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
    const { data, total } = readFeeHistory(limit, offset);
    return res.json({ ok: true, data, total });
  } catch (err) {
    console.error('[admin/rates/fee-history GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load fee history' });
  }
}
