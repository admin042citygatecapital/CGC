/**
 * POST /api/admin/cards/freeze
 * Body: { cardId, freeze?: boolean } — freeze defaults to true.
 */
import type { Request, Response } from 'express';
import { findCardById, updateCard, appendCardActivity } from '../../../../lib/cardStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { cardId, freeze } = req.body as { cardId?: string; freeze?: boolean };
  if (!cardId) return res.status(400).json({ ok: false, error: 'cardId is required' });

  const card = await findCardById(cardId);
  if (!card || card.status === 'deleted') return res.status(404).json({ ok: false, error: 'Card not found' });

  const shouldFreeze = freeze !== false;
  const updated = await updateCard(cardId, { status: shouldFreeze ? 'frozen' : 'active' });
  if (!updated) return res.status(500).json({ ok: false, error: 'Failed to update card' });

  await appendCardActivity({ cardId, userId: card.userId, event: shouldFreeze ? 'card_frozen' : 'card_unfrozen', adminId: session.adminId, ip: req.ip, ts: new Date().toISOString() });
  appendAudit({ event: shouldFreeze ? 'admin_card_frozen' : 'admin_card_unfrozen', adminId: session.adminId, userId: card.userId, ip: req.ip ?? 'unknown', meta: { cardId } });

  return res.json({ ok: true, card: updated });
}
