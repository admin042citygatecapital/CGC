/**
 * POST /api/users/trading/alerts
 * Body: { symbol, targetPrice, condition: 'above'|'below' } to create,
 *       or { action: 'delete', id } to remove one.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { createAlert, deleteAlert } from '../../../../lib/tradingStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isOneOf } from '../../../../lib/inputValidator.js';

const CONDITIONS = ['above', 'below'] as const;

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const raw = req.body as { action?: string; id?: string; symbol?: string; targetPrice?: number; condition?: unknown };

  if (raw.action === 'delete') {
    if (!raw.id) return res.status(400).json({ ok: false, error: 'id is required to delete an alert' });
    const ok = deleteAlert(raw.id, user.id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Alert not found' });
    return res.json({ ok: true });
  }

  const symbol = sanitizeString(raw.symbol, 20);
  const condition = isOneOf(raw.condition, CONDITIONS);
  const targetPrice = typeof raw.targetPrice === 'number' ? raw.targetPrice : NaN;
  if (!symbol || !condition || !Number.isFinite(targetPrice) || targetPrice <= 0) {
    return res.status(400).json({ ok: false, error: 'symbol, a valid condition, and a positive targetPrice are required' });
  }

  const alert = createAlert({ userId: user.id, symbol, targetPrice, condition });
  appendAudit({ event: 'user_trading_alert_created', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { alertId: alert.id, symbol, condition, targetPrice } });

  return res.status(201).json({ ok: true, alert });
}
