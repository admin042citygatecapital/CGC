/**
 * POST /api/admin/cards/pin
 * Set or reset a card PIN (admin-initiated).
 * Body: { cardId, pin }  — 4-digit string
 */
import type { Request, Response } from 'express';
import { findCardById, updateCard, appendCardActivity } from '../../../../lib/cardStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { hashPassword } from '../../../../lib/passwordHash.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession;
  if (!session) return res.status(401).json({ error: 'Authentication required' });

  const { cardId, pin } = req.body as { cardId?: string; pin?: string };
  if (!cardId) return res.status(400).json({ error: 'cardId is required' });
  if (!pin || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'pin must be exactly 4 digits' });

  const card = await findCardById(cardId);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const pinHash = await hashPassword(pin);
  await updateCard(cardId, { pinHash });
  appendCardActivity({ cardId, userId: card.userId, event: 'admin_pin_set', meta: { adminId: session.adminId }, ts: new Date().toISOString() }).catch(() => {});
  appendAudit({ event: 'admin_card_pin_set', adminId: session.adminId, userId: card.userId, ip: req.ip, meta: { cardId } });

  return res.json({ message: 'Card PIN updated successfully', cardId });
}
