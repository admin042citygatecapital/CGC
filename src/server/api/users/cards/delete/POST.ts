/**
 * POST /api/users/cards/delete
 * Body: { cardId: string }
 * Soft-deletes a virtual card. Ownership is enforced inside
 * cardStore.deleteCard(id, userId) itself (see its own doc comment — this
 * was previously an IDOR before that fix landed).
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { deleteCard, appendCardActivity } from '../../../../lib/cardStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { cardId } = req.body as { cardId?: string };
  if (!cardId) return res.status(400).json({ ok: false, error: 'cardId is required' });

  const ok = await deleteCard(cardId, user.id);
  if (!ok) return res.status(404).json({ ok: false, error: 'Card not found' });

  await appendCardActivity({ cardId, userId: user.id, event: 'card_deleted', ip: req.ip, ts: new Date().toISOString() });
  appendAudit({ event: 'user_card_deleted', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { cardId } });

  return res.json({ ok: true });
}
