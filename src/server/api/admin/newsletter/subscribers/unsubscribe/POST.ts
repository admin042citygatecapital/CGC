/**
 * POST /api/admin/newsletter/subscribers/unsubscribe
 * Body: { email }
 * Admin-initiated unsubscribe (reuses subscriberStore.ts's unsubscribe —
 * same function the customer-facing unsubscribe link uses).
 */
import type { Request, Response } from 'express';
import { unsubscribe } from '../../../../../lib/subscriberStore.js';
import { appendAudit } from '../../../../../lib/auditLog.js';
import { sanitizeString, isValidEmail } from '../../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const email = sanitizeString(req.body?.email).toLowerCase();
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'A valid email is required' });
  }

  const ok = await unsubscribe(email);
  if (!ok) return res.status(404).json({ ok: false, error: 'Subscriber not found' });

  appendAudit({ event: 'admin_newsletter_unsubscribe', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { subscriberEmail: email } });

  return res.json({ ok: true });
}
