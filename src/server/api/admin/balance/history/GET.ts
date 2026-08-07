/**
 * GET /api/admin/balance/history
 * Returns balance adjustment history.
 * Query: userId?, page?, limit?
 */
import type { Request, Response } from 'express';
import { queryBalanceTxs } from '../../../../lib/balanceStore.js';

export default function handler(req: Request, res: Response) {
  const userId = req.query.userId as string | undefined;
  const page   = Math.max(1, parseInt(String(req.query.page  ?? '1'), 10));
  const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10)));

  const result = queryBalanceTxs({ userId, page, limit });
  return res.json({ ...result, page, limit });
}
