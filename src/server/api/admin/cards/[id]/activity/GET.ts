/**
 * GET /api/admin/cards/:id/activity
 */
import type { Request, Response } from 'express';
import { findCardById, getCardActivity } from '../../../../../lib/cardStore.js';

export default async function handler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  if (!id) return res.status(400).json({ ok: false, error: 'Missing card id' });

  const card = await findCardById(id);
  if (!card) return res.status(404).json({ ok: false, error: 'Card not found' });

  const activity = await getCardActivity(id);
  return res.json({ ok: true, activity });
}
