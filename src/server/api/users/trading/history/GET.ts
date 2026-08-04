/**
 * GET /api/users/trading/history
 * Executed trades (fills), most recent first.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getTrades } from '../../../../lib/tradingStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const trades = (await getTrades(user.id)).sort((a, b) => b.executedAt.localeCompare(a.executedAt));
  return res.json({ ok: true, trades });
}
