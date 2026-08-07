/**
 * GET /api/users/trading/summary
 * Returns portfolio summary and open positions for the trading hub.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getPortfolioSummary, getPositions } from '../../../../lib/tradingStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const auth  = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const user = await findUserBySessionToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

    const [summary, positions] = await Promise.all([
      getPortfolioSummary(user.id),
      getPositions(user.id),
    ]);

    return res.json({ summary, positions });
  } catch (err) {
    console.error('[trading/summary]', err);
    return res.status(500).json({ error: 'Failed to load trading summary' });
  }
}
