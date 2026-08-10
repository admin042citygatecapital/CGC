/**
 * POST /api/users/trading/alerts
 * Create, dismiss, or delete a price alert.
 * Body: { action: 'create'|'dismiss'|'delete', ...fields }
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { type AssetClass } from '../../../../lib/tradingStore.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { privateSubdirectory } from '../../../../lib/storagePaths.js';

const ALERTS_DIR  = privateSubdirectory('trading');
const ALERTS_FILE = path.join(ALERTS_DIR, 'alerts.jsonl');

interface PriceAlert {
  id: string; userId: string; symbol: string; assetClass: string;
  targetPrice: number; condition: 'above' | 'below'; note?: string;
  status: 'active' | 'dismissed'; createdAt: string;
}

function readAll(): PriceAlert[] {
  try {
    if (!fs.existsSync(ALERTS_FILE)) return [];
    return fs.readFileSync(ALERTS_FILE, 'utf8').trim().split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter((a): a is PriceAlert => a !== null);
  } catch { return []; }
}

function writeAll(alerts: PriceAlert[]): void {
  if (!fs.existsSync(ALERTS_DIR)) fs.mkdirSync(ALERTS_DIR, { recursive: true });
  fs.writeFileSync(ALERTS_FILE, alerts.map(a => JSON.stringify(a)).join('\n') + '\n', 'utf8');
}

export default async (req: Request, res: Response) => {
  try {
    const auth  = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const user = await findUserBySessionToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

    const { action, id, symbol, assetClass, targetPrice, condition, note } = req.body as {
      action: 'create' | 'dismiss' | 'delete';
      id?: string; symbol?: string; assetClass?: AssetClass;
      targetPrice?: number; condition?: 'above' | 'below'; note?: string;
    };

    if (action === 'create') {
      if (!symbol || !assetClass || !targetPrice || !condition) {
        return res.status(400).json({ error: 'symbol, assetClass, targetPrice, condition are required' });
      }
      const alert: PriceAlert = {
        id:          'alrt_' + crypto.randomBytes(6).toString('hex'),
        userId:      user.id,
        symbol:      symbol.toUpperCase(),
        assetClass,
        targetPrice: Number(targetPrice),
        condition,
        note,
        status:      'active',
        createdAt:   new Date().toISOString(),
      };
      const all = readAll();
      all.push(alert);
      writeAll(all);
      return res.status(201).json({ alert });
    }

    if (action === 'dismiss') {
      if (!id) return res.status(400).json({ error: 'id is required' });
      const all     = readAll();
      const idx     = all.findIndex(a => a.id === id && a.userId === user.id);
      if (idx === -1) return res.status(404).json({ error: 'Alert not found' });
      all[idx].status = 'dismissed';
      writeAll(all);
      return res.json({ alert: all[idx] });
    }

    if (action === 'delete') {
      if (!id) return res.status(400).json({ error: 'id is required' });
      const all     = readAll();
      const filtered = all.filter(a => !(a.id === id && a.userId === user.id));
      if (filtered.length === all.length) return res.status(404).json({ error: 'Alert not found' });
      writeAll(filtered);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    console.error('[trading/alerts POST]', err);
    res.status(500).json({ error: 'Failed to process alert' });
  }
};
