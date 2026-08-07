/**
 * POST /api/admin/cards/spending-limit
 * Set or clear the daily spending limit on a card.
 * Body: { cardId, limitUsd }  — pass null to remove limit
 */
import type { Request, Response } from 'express';
import { findCardById, updateCard, appendCardActivity } from '../../../../lib/cardStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession;
  if (!session) return res.status(401).json({ error: 'Authentication required' });

  const { cardId, limitUsd } = req.body as { cardId?: string; limitUsd?: number | null };
  if (!cardId) return res.status(400).json({ error: 'cardId is required' });
  if (limitUsd !== null && limitUsd !== undefined && (typeof limitUsd !== 'number' || limitUsd < 0)) {
    return res.status(400).json({ error: 'limitUsd must be a non-negative number or null' });
  }

  const card = await findCardById(cardId);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const updated = await updateCard(cardId, { spendingLimit: limitUsd ?? null });
  if (!updated) return res.status(500).json({ error: 'Failed to update card' });

  appendCardActivity({ cardId, userId: card.userId, event: 'spending_limit_set', meta: { adminId: session.adminId, limitUsd }, ts: new Date().toISOString() }).catch(() => {});
  appendAudit({ event: 'admin_card_spending_limit', adminId: session.adminId, userId: card.userId, ip: req.ip, meta: { cardId, limitUsd } });

  return res.json({
    message: limitUsd == null ? 'Spending limit removed' : `Spending limit set to $${limitUsd}/day`,
    cardId,
    spendingLimitUsd: limitUsd ?? null,
  });
}
