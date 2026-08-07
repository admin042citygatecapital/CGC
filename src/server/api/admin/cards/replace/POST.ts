/**
 * POST /api/admin/cards/replace
 * Replace a card — marks old as replaced, issues a new one.
 * Body: { cardId }
 */
import type { Request, Response } from 'express';
import { findCardById, updateCard, createCard, appendCardActivity } from '../../../../lib/cardStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import crypto from 'node:crypto';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession;
  if (!session) return res.status(401).json({ error: 'Authentication required' });

  const { cardId } = req.body as { cardId?: string };
  if (!cardId) return res.status(400).json({ error: 'cardId is required' });

  const oldCard = await findCardById(cardId);
  if (!oldCard || oldCard.status === 'deleted') {
    return res.status(404).json({ error: 'Card not found or already deleted' });
  }

  // Mark old card as replaced
  await updateCard(cardId, { status: 'replaced' });

  // Issue replacement card
  const now     = new Date();
  const expYear = now.getFullYear() + 4;
  const expMon  = String(now.getMonth() + 1).padStart(2, '0');
  const expiry  = `${expMon}/${String(expYear).slice(-2)}`;
  const number  = Array.from({ length: 16 }, () => crypto.randomInt(0, 10)).join('');
  const cvv     = String(crypto.randomInt(100, 1000));

  const replacement = await createCard({
    userId:           oldCard.userId,
    cardholderName:   oldCard.cardholderName,
    number,
    cvv,
    expiry,
    network:          oldCard.network,
    status:           'active',
    spendingLimit:    oldCard.spendingLimit ?? null,
  });

  appendCardActivity({ cardId: replacement.id, userId: replacement.userId, event: 'admin_replaced', meta: { adminId: session.adminId, replacedCardId: cardId }, ts: new Date().toISOString() }).catch(() => {});
  appendAudit({ event: 'admin_card_replaced', adminId: session.adminId, userId: oldCard.userId, ip: req.ip, meta: { oldCardId: cardId, newCardId: replacement.id } });

  return res.json({
    message: 'Card replaced successfully',
    replacedCardId: cardId,
    replacement: {
      id:             replacement.id,
      cardholderName: replacement.cardholderName,
      numberMasked:   replacement.number.slice(0, 4) + ' **** **** ' + replacement.number.slice(-4),
      expiry:         replacement.expiry,
      network:        replacement.network,
      status:         replacement.status,
      createdAt:      replacement.createdAt,
    },
  });
}
