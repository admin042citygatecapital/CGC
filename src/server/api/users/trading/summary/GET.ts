/**
 * GET /api/users/trading/summary
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getTradingStats } from '../../../../lib/tradingStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const stats = await getTradingStats(user.id);
  return res.json({ ok: true, stats });
}
