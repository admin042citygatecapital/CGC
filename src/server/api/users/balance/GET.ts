/**
 * GET /api/users/balance
 * Returns the authenticated customer's own balance/currency.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  return res.json({ ok: true, balance: user.balance ?? 0, currency: user.primaryCurrency ?? 'USD' });
}
