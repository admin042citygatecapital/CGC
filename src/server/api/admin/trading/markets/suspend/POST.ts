/**
 * POST /api/admin/trading/markets/suspend
 * Body: { id: string, reason?: string, action?: 'suspend' | 'resume' }
 * Suspends a market (default), or resumes it when action is 'resume' —
 * there's no separate resume route, so this endpoint covers both directions.
 */
import type { Request, Response } from 'express';
import { suspendMarket, resumeMarket, appendTradingLog } from '../../../../../lib/tradingAdminStore.js';
import { appendAudit } from '../../../../../lib/auditLog.js';
import { sanitizeString, isOneOf } from '../../../../../lib/inputValidator.js';

const ACTIONS = ['suspend', 'resume'] as const;

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { id?: string; reason?: unknown; action?: unknown };
  const action = isOneOf(raw.action, ACTIONS) ?? 'suspend';

  if (!raw.id) return res.status(400).json({ ok: false, error: 'id is required' });

  const adminId = req.adminSession?.adminId ?? 'admin';
  const adminEmail = req.adminSession?.email ?? '';
  const ip = req.ip ?? 'unknown';

  if (action === 'resume') {
    const market = resumeMarket(raw.id);
    if (!market) return res.status(404).json({ ok: false, error: 'Market not found' });

    appendTradingLog({ action: 'market_resumed', category: 'market', targetId: raw.id, targetLabel: market.symbol, details: `Resumed market ${market.symbol}`, adminId, adminEmail, ip });
    appendAudit({ event: 'trading_market_resumed', adminId, email: adminEmail, ip, meta: { id: raw.id, symbol: market.symbol } });
    return res.json({ ok: true, market });
  }

  const reason = sanitizeString(raw.reason, 500);
  if (!reason) return res.status(400).json({ ok: false, error: 'reason is required to suspend a market' });

  const market = suspendMarket(raw.id, reason, adminId);
  if (!market) return res.status(404).json({ ok: false, error: 'Market not found' });

  appendTradingLog({ action: 'market_suspended', category: 'market', targetId: raw.id, targetLabel: market.symbol, details: `Suspended market ${market.symbol}: ${reason}`, adminId, adminEmail, ip });
  appendAudit({ event: 'trading_market_suspended', adminId, email: adminEmail, ip, meta: { id: raw.id, symbol: market.symbol, reason } });
  return res.json({ ok: true, market });
}
