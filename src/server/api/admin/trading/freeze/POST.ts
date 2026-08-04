/**
 * POST /api/admin/trading/freeze
 * Body: { action: 'freeze_all' | 'unfreeze_all', reason: string }
 * Global trading kill-switch. isTradingFrozen() (read by order-placement
 * routes once they exist) is derived from the most recent event of this kind.
 */
import type { Request, Response } from 'express';
import { appendFreezeEvent, appendTradingLog, isTradingFrozen } from '../../../../lib/tradingAdminStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isOneOf } from '../../../../lib/inputValidator.js';

const ACTIONS = ['freeze_all', 'unfreeze_all'] as const;

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { action?: unknown; reason?: unknown };
  const action = isOneOf(raw.action, ACTIONS);
  const reason = sanitizeString(raw.reason, 500);

  if (!action) {
    return res.status(400).json({ ok: false, error: "action must be 'freeze_all' or 'unfreeze_all'" });
  }
  if (!reason) {
    return res.status(400).json({ ok: false, error: 'reason is required' });
  }

  const adminId = req.adminSession?.adminId ?? 'admin';
  const adminEmail = req.adminSession?.email ?? '';
  const ip = req.ip ?? 'unknown';

  const event = appendFreezeEvent({ type: action, reason, adminId, adminEmail });

  appendTradingLog({
    action, category: 'freeze',
    details: `${action === 'freeze_all' ? 'Froze' : 'Unfroze'} all trading: ${reason}`,
    adminId, adminEmail, ip,
  });
  appendAudit({ event: `trading_${action}`, adminId, email: adminEmail, ip, meta: { reason } });

  return res.json({ ok: true, event, frozen: isTradingFrozen() });
}
