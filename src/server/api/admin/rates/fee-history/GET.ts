/**
 * GET /api/admin/rates/fee-history
 * Returns the fee change history log.
 * Query: ?limit=200&offset=0&csv=1
 */
import type { Request, Response } from 'express';
import { readFeeHistory, feeHistoryCsv } from '../../../../lib/ratesStore.js';

export default function handler(req: Request, res: Response) {
  if (req.query.csv === '1') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="fee-history.csv"');
    return res.send(feeHistoryCsv());
  }

  const limit  = Math.min(Number(req.query.limit  ?? 200), 500);
  const offset = Number(req.query.offset ?? 0);
  return res.json(readFeeHistory(limit, offset));
}
