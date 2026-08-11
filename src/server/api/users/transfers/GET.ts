/**
 * GET /api/users/transfers
 * Returns the customer's transfer transaction history (type=transfer).
 */
import type { Request, Response } from 'express';
import { getTransactionsForUser } from '../../../lib/transactionStore.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10), 500);
  const all   = await getTransactionsForUser(user.id, { limit: 500 });

  // Return all transaction types but label them; frontend filters as needed
  const transfers = all.transactions
    .filter(t => ['transfer', 'deposit', 'withdrawal', 'fee'].includes(t.type))
    .slice(0, limit);

  return res.json({ transfers, total: transfers.length });
}
