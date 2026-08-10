/**
 * GET /api/users/trading/alerts
 * Returns all price alerts for the authenticated user.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getLivePrice } from '../../../../lib/tradingStore.js';
import fs from 'node:fs';
import { privateSubdirectory } from '../../../../lib/storagePaths.js';

const ALERTS_FILE = privateSubdirectory('trading/alerts.jsonl');

interface PriceAlert {
  id: string; userId: string; symbol: string; assetClass: string;
  targetPrice: number; condition: 'above' | 'below'; note?: string;
  status: 'active' | 'dismissed'; createdAt: string;
}

function readAlerts(userId: string): PriceAlert[] {
  try {
    if (!fs.existsSync(ALERTS_FILE)) return [];
    return fs.readFileSync(ALERTS_FILE, 'utf8').trim().split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter((a): a is PriceAlert => a !== null && a.userId === userId);
  } catch { return []; }
}

export default async (req: Request, res: Response) => {
  try {
    const auth  = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const user = await findUserBySessionToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

    const alerts = readAlerts(user.id).map(a => ({
      ...a,
      currentPrice: getLivePrice(a.symbol),
      triggered: a.condition === 'above'
        ? getLivePrice(a.symbol) >= a.targetPrice
        : getLivePrice(a.symbol) <= a.targetPrice,
    }));

    res.json({ alerts });
  } catch (err) {
    console.error('[trading/alerts GET]', err);
    res.status(500).json({ error: 'Failed to load alerts' });
  }
};
