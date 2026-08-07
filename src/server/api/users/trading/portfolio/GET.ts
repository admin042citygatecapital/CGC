import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getPortfolioSummary, getPositions } from '../../../../lib/tradingStore.js';

export default async (req: Request, res: Response) => {
  try {
    const auth  = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const user = await findUserBySessionToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

    const [summary, positions] = await Promise.all([
      getPortfolioSummary(user.id),
      getPositions(user.id),
    ]);
    res.json({ summary, positions });
  } catch (err) {
    console.error('[trading/portfolio]', err);
    res.status(500).json({ error: 'Failed to load portfolio' });
  }
};
