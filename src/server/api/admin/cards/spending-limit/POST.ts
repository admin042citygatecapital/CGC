/**
 * POST /api/admin/cards/spending-limit
 * Body: { cardId, spendingLimit: number | null } — null clears the limit.
 */
import type { Request, Response } from 'express';
import { findCardById, updateCard, appendCardActivity } from '../../../../lib/cardStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { cardId, spendingLimit } = req.body as { cardId?: string; spendingLimit?: number | null };
  if (!cardId) return res.status(400).json({ ok: false, error: 'cardId is required' });
  if (spendingLimit !== null && (typeof spendingLimit !== 'number' || spendingLimit < 0)) {
    return res.status(400).json({ ok: false, error: 'spendingLimit must be a non-negative number or null' });
  }

  const card = await findCardById(cardId);
  if (!card || card.status === 'deleted') return res.status(404).json({ ok: false, error: 'Card not found' });

  const updated = await updateCard(cardId, { spendingLimit });
  if (!updated) return res.status(500).json({ ok: false, error: 'Failed to update spending limit' });

  await appendCardActivity({ cardId, userId: card.userId, event: 'card_spending_limit_updated', adminId: session.adminId, meta: { spendingLimit }, ts: new Date().toISOString() });
  appendAudit({ event: 'admin_card_spending_limit_updated', adminId: session.adminId, userId: card.userId, ip: req.ip ?? 'unknown', meta: { cardId, spendingLimit } });

  return res.json({ ok: true, card: updated });
}
