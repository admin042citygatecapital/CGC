import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getTrades } from '../../../../lib/tradingStore.js';

export default async (req: Request, res: Response) => {
  try {
    const auth  = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const user = await findUserBySessionToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

    const limit  = Math.min(parseInt(req.query.limit as string ?? '100', 10), 500);
    const trades = (await getTrades(user.id))
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
      .slice(0, limit);
    res.json({ trades });
  } catch (err) {
    console.error('[trading/history]', err);
    res.status(500).json({ error: 'Failed to load trade history' });
  }
};
