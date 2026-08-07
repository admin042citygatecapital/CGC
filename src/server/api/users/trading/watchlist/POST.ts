import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { addToWatchlist, removeFromWatchlist, type AssetClass } from '../../../../lib/tradingStore.js';

export default async (req: Request, res: Response) => {
  try {
    const auth  = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const user = await findUserBySessionToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

    const { action, symbol, assetClass } = req.body as {
      action: 'add' | 'remove'; symbol: string; assetClass?: AssetClass;
      alertPrice?: number; note?: string;
    };
    if (!symbol) return res.status(400).json({ error: 'symbol is required' });
    if (action === 'remove') {
      await removeFromWatchlist(user.id, symbol);
      return res.json({ ok: true });
    }
    if (!assetClass) return res.status(400).json({ error: 'assetClass is required for add' });
    const entry = await addToWatchlist(user.id, symbol, assetClass);
    res.status(201).json({ entry });
  } catch (err) {
    console.error('[trading/watchlist POST]', err);
    res.status(500).json({ error: 'Failed to update watchlist' });
  }
};
