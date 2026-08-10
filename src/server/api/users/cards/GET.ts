/** GET /api/users/cards — safe metadata for synthetic/deferred card records. */
import type { Request, Response } from 'express';
import { getCardSummariesForUser } from '../../../lib/cardStore.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const cards = (await getCardSummariesForUser(user.id)).map(card => ({
    id: card.id,
    cardholderName: card.cardholderName,
    numberMasked: `**** **** **** ${card.last4}`,
    expiry: card.expiry,
    network: card.network,
    status: card.status,
    createdAt: card.createdAt,
  }));

  return res.json({
    cards,
    dataClassification: 'synthetic_preview_card_records',
    operationsAvailable: false,
  });
}
