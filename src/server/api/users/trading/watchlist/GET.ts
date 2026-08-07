import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getWatchlist, getLivePrice, get24hChange, get24hVolume } from '../../../../lib/tradingStore.js';

export default async (req: Request, res: Response) => {
  try {
    const auth  = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const user = await findUserBySessionToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

    const entries = (await getWatchlist(user.id)).map(w => ({
      ...w,
      price:     getLivePrice(w.symbol),
      change24h: get24hChange(w.symbol),
      volume24h: get24hVolume(w.symbol),
    }));
    res.json({ watchlist: entries });
  } catch (err) {
    console.error('[trading/watchlist GET]', err);
    res.status(500).json({ error: 'Failed to load watchlist' });
  }
};
