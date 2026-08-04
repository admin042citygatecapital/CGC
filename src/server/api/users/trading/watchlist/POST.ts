/**
 * POST /api/users/trading/watchlist
 * Body: { symbol: string, assetClass: 'crypto'|'forex'|'stock'|'commodity'|'etf', action?: 'remove' }
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { addToWatchlist, removeFromWatchlist, type AssetClass } from '../../../../lib/tradingStore.js';
import { isOneOf, sanitizeString } from '../../../../lib/inputValidator.js';

const ASSET_CLASSES = ['crypto', 'forex', 'stock', 'commodity', 'etf'] as const satisfies readonly AssetClass[];

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const raw = req.body as { symbol?: string; assetClass?: unknown; action?: string };
  const symbol = sanitizeString(raw.symbol, 20);
  if (!symbol) return res.status(400).json({ ok: false, error: 'symbol is required' });

  if (raw.action === 'remove') {
    const ok = await removeFromWatchlist(user.id, symbol);
    if (!ok) return res.status(404).json({ ok: false, error: 'Not on watchlist' });
    return res.json({ ok: true });
  }

  const assetClass = isOneOf(raw.assetClass, ASSET_CLASSES);
  if (!assetClass) return res.status(400).json({ ok: false, error: 'A valid assetClass is required' });

  const entry = await addToWatchlist(user.id, symbol, assetClass);
  return res.status(201).json({ ok: true, entry });
}
