/**
 * GET /api/admin/transactions/real
 * Returns real persistent transactions from transactionStore.
 * Query: userId?, type?, status?, currency?, search?, flagged?, from?, to?, page?, limit?
 */
import type { Request, Response } from 'express';
import { queryTransactions, txStats, type TxType, type TxStatus, type TxCurrency } from '../../../../lib/transactionStore.js';

export default async function handler(req: Request, res: Response) {
  const {
    userId, type, status, currency, search, flagged,
    from, to, page = '1', limit = '25',
  } = req.query as Record<string, string>;

  const result = await queryTransactions({
    userId,
    type:     type     as TxType     | undefined,
    status:   status   as TxStatus   | undefined,
    currency: currency as TxCurrency | undefined,
    search,
    flagged:  flagged !== undefined ? flagged === 'true' : undefined,
    from,
    to,
    page:  parseInt(page,  10) || 1,
    limit: Math.min(100, parseInt(limit, 10) || 25),
  });

  const stats = await txStats();

  return res.json({ ok: true, ...result,
    stats,
    page:  parseInt(page,  10) || 1,
    limit: Math.min(100, parseInt(limit, 10) || 25),
    pages: Math.max(1, Math.ceil(result.total / (parseInt(limit, 10) || 25))),
  });
}
