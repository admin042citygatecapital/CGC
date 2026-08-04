/**
 * GET /api/users/cards
 * Returns the authenticated customer's virtual cards (excludes deleted).
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { getCardsForUser } from '../../../lib/cardStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const cards = (await getCardsForUser(user.id)).filter(c => c.status !== 'deleted');
  return res.json({ ok: true, cards });
}
