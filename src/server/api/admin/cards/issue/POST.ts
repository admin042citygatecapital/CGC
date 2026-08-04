/**
 * POST /api/admin/cards/issue
 * Body: { userId, network?: 'visa'|'mastercard', spendingLimit?, cardholderName? }
 * Admin-issued virtual card for any customer (issuedByAdmin: true) — no
 * per-user card cap, unlike the self-service users/cards/generate.
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../lib/userStore.js';
import { createCard, appendCardActivity, type CardNetwork } from '../../../../lib/cardStore.js';
import { generateCardNumber, generateExpiry, generateCvv } from '../../../../lib/cardNumberGenerator.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const raw = req.body as { userId?: string; network?: string; spendingLimit?: number; cardholderName?: string };
  if (!raw.userId) return res.status(400).json({ ok: false, error: 'userId is required' });

  const user = await findUserById(raw.userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  const network: CardNetwork = raw.network === 'mastercard' ? 'mastercard' : 'visa';
  const spendingLimit = typeof raw.spendingLimit === 'number' && raw.spendingLimit > 0 ? raw.spendingLimit : undefined;
  const cardholderName = sanitizeString(raw.cardholderName, 200) || user.name;

  const card = await createCard({
    userId: user.id,
    cardholderName,
    number: generateCardNumber(network),
    expiry: generateExpiry(),
    cvv: generateCvv(),
    network,
    status: 'active',
    spendingLimit,
    issuedByAdmin: true,
  });

  await appendCardActivity({ cardId: card.id, userId: user.id, event: 'card_issued', adminId: session.adminId, ts: new Date().toISOString() });
  appendAudit({ event: 'admin_card_issued', adminId: session.adminId, userId: user.id, ip: req.ip ?? 'unknown', meta: { cardId: card.id, network } });

  return res.status(201).json({ ok: true, card });
}
