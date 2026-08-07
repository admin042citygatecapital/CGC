/**
 * POST /api/users/cards/delete
 * Deletes (soft-deletes) a virtual card owned by the authenticated customer.
 * Body: { cardId }
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { deleteCard } from '../../../../lib/cardStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const { cardId } = req.body ?? {};
  if (!cardId) return res.status(400).json({ error: 'cardId is required' });

  const ok = await deleteCard(cardId, user.id);
  if (!ok) return res.status(404).json({ error: 'Card not found' });

  return res.json({ ok: true });
}
