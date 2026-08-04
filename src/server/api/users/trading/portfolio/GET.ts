/**
 * GET /api/users/trading/portfolio
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getOpenPositions, getPortfolioSummary } from '../../../../lib/tradingStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const [summary, positions] = await Promise.all([
    getPortfolioSummary(user.id),
    getOpenPositions(user.id),
  ]);

  return res.json({ ok: true, summary, positions });
}
