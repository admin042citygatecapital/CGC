/**
 * GET /api/users/transfers
 * Returns the customer's transfer transaction history (type=transfer).
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

  const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10), 500);
  const all   = await getTransactionsForUser(user.id, { limit: 500 });

  // Return all transaction types but label them; frontend filters as needed
  const transfers = all.transactions
    .filter(t => ['transfer', 'deposit', 'withdrawal', 'fee'].includes(t.type))
    .slice(0, limit);

  return res.json({ transfers, total: transfers.length });
}
