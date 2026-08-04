/**
 * POST /api/users/cards/generate
 * Body: { network?: 'visa' | 'mastercard' (default 'visa'), spendingLimit? }
 * Self-service instant virtual card issuance — see cardNumberGenerator.ts
 * for why these are synthetic numbers, not real issuable PANs.
 *
 * Caps at 5 active cards per user — a default operational safeguard, not
 * a documented product limit; adjust if the real requirement differs.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { getCardsForUser, createCard, appendCardActivity, type CardNetwork } from '../../../../lib/cardStore.js';
import { generateCardNumber, generateExpiry, generateCvv } from '../../../../lib/cardNumberGenerator.js';
import { appendAudit } from '../../../../lib/auditLog.js';

const MAX_ACTIVE_CARDS = 5;

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const activeCards = (await getCardsForUser(user.id)).filter(c => c.status === 'active' || c.status === 'frozen');
  if (activeCards.length >= MAX_ACTIVE_CARDS) {
    return res.status(400).json({ ok: false, error: `You can have up to ${MAX_ACTIVE_CARDS} active virtual cards` });
  }

  const raw = req.body as { network?: string; spendingLimit?: number };
  const network: CardNetwork = raw.network === 'mastercard' ? 'mastercard' : 'visa';
  const spendingLimit = typeof raw.spendingLimit === 'number' && raw.spendingLimit > 0 ? raw.spendingLimit : undefined;

  const card = await createCard({
    userId: user.id,
    cardholderName: user.name,
    number: generateCardNumber(network),
    expiry: generateExpiry(),
    cvv: generateCvv(),
    network,
    status: 'active',
    spendingLimit,
    issuedByAdmin: false,
  });

  await appendCardActivity({ cardId: card.id, userId: user.id, event: 'card_issued', ip: req.ip, ts: new Date().toISOString() });
  appendAudit({ event: 'user_card_generated', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { cardId: card.id, network } });

  return res.status(201).json({ ok: true, card });
}
