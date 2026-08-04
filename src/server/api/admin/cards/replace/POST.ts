/**
 * POST /api/admin/cards/replace
 * Body: { cardId, reason? }
 * Marks the existing card 'replaced' and issues a brand-new card (new
 * number/expiry/cvv, same user/network/spending limit), linking the old
 * card to the new one via replacedById.
 */
import type { Request, Response } from 'express';
import { findCardById, updateCard, createCard, appendCardActivity } from '../../../../lib/cardStore.js';
import { generateCardNumber, generateExpiry, generateCvv } from '../../../../lib/cardNumberGenerator.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { cardId } = req.body as { cardId?: string };
  const reason = sanitizeString((req.body as { reason?: unknown }).reason, 500);
  if (!cardId) return res.status(400).json({ ok: false, error: 'cardId is required' });

  const oldCard = await findCardById(cardId);
  if (!oldCard || oldCard.status === 'deleted') return res.status(404).json({ ok: false, error: 'Card not found' });

  const newCard = await createCard({
    userId: oldCard.userId,
    cardholderName: oldCard.cardholderName,
    number: generateCardNumber(oldCard.network),
    expiry: generateExpiry(),
    cvv: generateCvv(),
    network: oldCard.network,
    status: 'active',
    spendingLimit: oldCard.spendingLimit,
    issuedByAdmin: true,
  });

  await updateCard(cardId, { status: 'replaced', replacedById: newCard.id });

  await appendCardActivity({ cardId, userId: oldCard.userId, event: 'card_replaced', adminId: session.adminId, meta: { newCardId: newCard.id, reason }, ts: new Date().toISOString() });
  await appendCardActivity({ cardId: newCard.id, userId: oldCard.userId, event: 'card_issued', adminId: session.adminId, meta: { replacesCardId: cardId }, ts: new Date().toISOString() });
  appendAudit({ event: 'admin_card_replaced', adminId: session.adminId, userId: oldCard.userId, ip: req.ip ?? 'unknown', meta: { oldCardId: cardId, newCardId: newCard.id, reason } });

  return res.status(201).json({ ok: true, newCard });
}
