/**
 * GET /api/users/cards
 * Returns the authenticated customer's virtual cards (number masked).
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { getCardsForUser } from '../../../lib/cardStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const cards = (await getCardsForUser(user.id)).map(c => ({
    id:             c.id,
    cardholderName: c.cardholderName,
    // Masked number only — full PAN never returned (PCI-DSS requirement)
    numberMasked:   c.number.slice(0, 4) + ' **** **** ' + c.number.slice(-4),
    // numberFull intentionally omitted — full PAN must never be sent to the client
    // cvv intentionally omitted — CVV must never be returned after authorisation
    expiry:         c.expiry,
    network:        c.network,
    status:         c.status,
    createdAt:      c.createdAt,
  }));

  return res.json({ cards });
}
