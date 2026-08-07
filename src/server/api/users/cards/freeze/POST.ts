/**
 * POST /api/users/cards/freeze
 * Toggles freeze/unfreeze on a card owned by the authenticated customer.
 * Body: { cardId }
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { findCardById, updateCard } from '../../../../lib/cardStore.js';

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  const { cardId } = req.body ?? {};
  if (!cardId) return res.status(400).json({ error: 'cardId is required' });

  const card = await findCardById(cardId);
  if (!card || card.userId !== user.id) return res.status(404).json({ error: 'Card not found' });

  const newStatus = card.status === 'frozen' ? 'active' : 'frozen';
  const updated   = await updateCard(cardId, { status: newStatus });
  if (!updated) return res.status(500).json({ error: 'Failed to update card' });

  return res.json({ ok: true, status: updated.status });
}
