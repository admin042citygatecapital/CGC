/**
 * POST /api/admin/cards/issue
 * Issue a new virtual card for any customer.
 * Body: { userId, network? }
 */
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { createCard, appendCardActivity } from '../../../../lib/cardStore.js';
import { findUserById } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { requireFinancialOperations } from '../../../../lib/platformMode.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession;
  if (!session) return res.status(401).json({ error: 'Authentication required' });
  if (!requireFinancialOperations(res)) return;

  const { userId, network } = req.body as { userId?: string; network?: string };
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const net = (network === 'mastercard' ? 'mastercard' : 'visa') as 'visa' | 'mastercard';

  // Generate card details
  const now     = new Date();
  const expYear = now.getFullYear() + 4;
  const expMon  = String(now.getMonth() + 1).padStart(2, '0');
  const expiry  = `${expMon}/${String(expYear).slice(-2)}`;
  const number  = Array.from({ length: 16 }, () => crypto.randomInt(0, 10)).join('');
  const cvv     = String(crypto.randomInt(100, 1000));

  const card = await createCard({
    userId,
    cardholderName: user.name,
    number,
    cvv,
    expiry,
    network: net,
    status:  'active',
    spendingLimit: null,
  });

  appendCardActivity({ cardId: card.id, userId, event: 'admin_issued', meta: { adminId: session.adminId }, ts: new Date().toISOString() }).catch(() => {});
  appendAudit({ event: 'admin_card_issued', adminId: session.adminId, userId, ip: req.ip, meta: { cardId: card.id, network: net } });

  return res.status(201).json({
    message: `Card issued for ${user.name}`,
    card: {
      id:             card.id,
      cardholderName: card.cardholderName,
      numberMasked:   card.number.slice(0, 4) + ' **** **** ' + card.number.slice(-4),
      expiry:         card.expiry,
      network:        card.network,
      status:         card.status,
      createdAt:      card.createdAt,
    },
  });
}
