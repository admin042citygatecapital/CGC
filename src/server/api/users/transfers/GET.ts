/**
 * GET /api/users/transfers
 * Returns the authenticated customer's transfer history.
 * Query params: page (default 1), limit (default 20, max 100)
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { queryTransactions } from '../../../lib/transactionStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));

  const { data, total } = await queryTransactions({ userId: user.id, type: 'transfer', page, limit });

  return res.json({ ok: true, transfers: data, total, page, limit });
}
