/**
 * GET /api/admin/cards
 * Query: userId?, status?
 *
 * PCI: never return full PAN or CVV in a list view — admins get last4 only.
 * CVV in particular must not be retrievable after card issuance.
 */
import type { Request, Response } from 'express';
import { getAllCards } from '../../../lib/cardStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    let cards = await getAllCards();
    const { userId, status } = req.query as { userId?: string; status?: string };
    if (userId) cards = cards.filter(c => c.userId === userId);
    if (status) cards = cards.filter(c => c.status === status);
    const masked = cards.map(({ number, cvv: _cvv, pinHash: _pinHash, ...rest }) => ({
      ...rest,
      last4: number.slice(-4),
    }));
    return res.json({ ok: true, cards: masked });
  } catch (err) {
    console.error('[admin/cards GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load cards' });
  }
}
