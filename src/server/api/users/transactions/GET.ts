/**
 * GET /api/users/transactions
 * Returns the authenticated customer's transaction history.
 * Query params: limit (default 50, max 200), offset (default 0)
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { getTransactionsForUser } from '../../../lib/transactionStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit  as string, 10) || 50));
  const offset = Math.max(0,                parseInt(req.query.offset as string, 10) || 0);

  const { transactions, total } = await getTransactionsForUser(user.id, { limit, offset });

  return res.json({ ok: true, transactions, total, limit, offset });
}
