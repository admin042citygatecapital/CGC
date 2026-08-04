/**
 * POST /api/admin/cards/pin
 * Body: { cardId, pin: string (4-6 digits) }
 * Sets/resets a card's PIN. Hashed with the same Argon2id
 * (passwordHash.ts) used for account passwords elsewhere in this
 * codebase, rather than inventing a separate, weaker PIN hash.
 */
import type { Request, Response } from 'express';
import { findCardById, updateCard, appendCardActivity } from '../../../../lib/cardStore.js';
import { hashPassword } from '../../../../lib/passwordHash.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { cardId, pin } = req.body as { cardId?: string; pin?: string };
  if (!cardId) return res.status(400).json({ ok: false, error: 'cardId is required' });
  if (!pin || !/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ ok: false, error: 'pin must be 4-6 digits' });
  }

  const card = await findCardById(cardId);
  if (!card || card.status === 'deleted') return res.status(404).json({ ok: false, error: 'Card not found' });

  const pinHash = await hashPassword(pin);
  const updated = await updateCard(cardId, { pinHash });
  if (!updated) return res.status(500).json({ ok: false, error: 'Failed to set PIN' });

  await appendCardActivity({ cardId, userId: card.userId, event: 'card_pin_set', adminId: session.adminId, ts: new Date().toISOString() });
  appendAudit({ event: 'admin_card_pin_set', adminId: session.adminId, userId: card.userId, ip: req.ip ?? 'unknown', meta: { cardId } });

  return res.json({ ok: true, message: 'PIN updated.' });
}
