/**
 * POST /api/users/cards/freeze
 * Body: { cardId: string, freeze?: boolean } — freeze defaults to true;
 * pass freeze: false to unfreeze.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { findCardById, updateCard, appendCardActivity } from '../../../../lib/cardStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { cardId, freeze } = req.body as { cardId?: string; freeze?: boolean };
  if (!cardId) return res.status(400).json({ ok: false, error: 'cardId is required' });

  const card = await findCardById(cardId);
  if (!card || card.userId !== user.id || card.status === 'deleted') {
    return res.status(404).json({ ok: false, error: 'Card not found' });
  }

  const shouldFreeze = freeze !== false;
  if (shouldFreeze && card.status === 'frozen') return res.json({ ok: true, card });
  if (!shouldFreeze && card.status === 'active') return res.json({ ok: true, card });

  const updated = await updateCard(cardId, { status: shouldFreeze ? 'frozen' : 'active' });
  if (!updated) return res.status(500).json({ ok: false, error: 'Failed to update card' });

  await appendCardActivity({
    cardId, userId: user.id, event: shouldFreeze ? 'card_frozen' : 'card_unfrozen',
    ip: req.ip, ts: new Date().toISOString(),
  });
  appendAudit({ event: shouldFreeze ? 'user_card_frozen' : 'user_card_unfrozen', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { cardId } });

  return res.json({ ok: true, card: updated });
}
