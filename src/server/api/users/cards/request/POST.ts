/**
 * POST /api/users/cards/request
 * Body: { cardId: string, note?: string }
 * Requests a physical card tied to an existing virtual card. There's no
 * physical-card fulfillment pipeline or dedicated status field in this
 * codebase (CardStatus is 'active'|'frozen'|'deleted'|'replaced' — no
 * 'pending_physical' state), so this records the request as card activity
 * + an admin-facing audit/email notification for manual follow-up, rather
 * than inventing a status this data model doesn't have.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { findCardById, appendCardActivity } from '../../../../lib/cardStore.js';
import { sendMail } from '../../../../lib/emailService.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { cardId } = req.body as { cardId?: string; note?: unknown };
  if (!cardId) return res.status(400).json({ ok: false, error: 'cardId is required' });

  const card = await findCardById(cardId);
  if (!card || card.userId !== user.id || card.status === 'deleted') {
    return res.status(404).json({ ok: false, error: 'Card not found' });
  }

  const note = sanitizeString((req.body as { note?: unknown }).note, 500);

  await appendCardActivity({
    cardId, userId: user.id, event: 'physical_card_requested',
    meta: note ? { note } : undefined,
    ip: req.ip, ts: new Date().toISOString(),
  });
  appendAudit({ event: 'user_physical_card_requested', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { cardId } });

  sendMail({
    to: 'admin@citygate.capital',
    subject: `Physical card request — ${user.name} (${user.email})`,
    html: `<p>${user.name} (${user.email}) requested a physical card for card ending ${card.number.slice(-4)}.</p>${note ? `<p>Note: ${note}</p>` : ''}`,
  }).catch(() => {});

  return res.status(201).json({ ok: true, message: 'Physical card request submitted. Our team will follow up.' });
}
