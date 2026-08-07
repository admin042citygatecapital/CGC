/**
 * GET /api/users/transactions
 * Returns the authenticated customer's transaction history.
 * Query params: limit (default 20), offset (default 0)
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { getTransactionsForUser } from '../../../lib/transactionStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const limit  = Math.min(parseInt(String(req.query.limit  ?? '20'), 10) || 20, 100);
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'),  10) || 0,  0);

  const { transactions, total } = await getTransactionsForUser(user.id, { limit, offset });

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
