/**
 * GET /api/users/transactions
 * Returns the authenticated customer's transaction history.
 * Query params: limit (default 20), offset (default 0)
 */
import type { Request, Response } from 'express';
import { queryTransactions, type TxCurrency, type TxStatus, type TxType } from '../../../lib/transactionStore.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const limit  = Math.min(parseInt(String(req.query.limit  ?? '20'), 10) || 20, 100);
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'),  10) || 0,  0);

  const page = Math.floor(offset / limit) + 1;
  const result = await queryTransactions({
    userId: user.id,
    limit,
    page,
    search: typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : undefined,
    currency: typeof req.query.currency === 'string' ? req.query.currency as TxCurrency : undefined,
    status: typeof req.query.status === 'string' ? req.query.status as TxStatus : undefined,
    type: typeof req.query.category === 'string' ? req.query.category as TxType : undefined,
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
  });
  const transactions = result.data;
  const total = result.total;

  // Return only fields safe to expose to the customer
  const safe = transactions.map(tx => ({
    id:          tx.id,
    type:        tx.type,
    status:      tx.status,
    amount:      tx.amount,
    currency:    tx.currency,
    description: tx.description,
    reference:   tx.reference,
    createdAt:   tx.createdAt,
  }));

  return res.json({ transactions: safe, total, limit, offset });
}
