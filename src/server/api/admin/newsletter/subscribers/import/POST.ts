/**
 * POST /api/admin/newsletter/subscribers/import
 * Body: { subscribers: Array<{ email: string, name?: string }> }
 * Bulk-adds subscribers via the existing subscriberStore.ts (reused, not
 * duplicated). Invalid/duplicate emails are skipped, not treated as
 * fatal errors.
 */
import type { Request, Response } from 'express';
import { addSubscriber, findSubscriberByEmail } from '../../../../../lib/subscriberStore.js';
import { appendAudit } from '../../../../../lib/auditLog.js';
import { isValidEmail, sanitizeString } from '../../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const { subscribers } = req.body as { subscribers?: Array<{ email?: string; name?: string }> };
  if (!Array.isArray(subscribers) || subscribers.length === 0) {
    return res.status(400).json({ ok: false, error: 'subscribers must be a non-empty array' });
  }

  let imported = 0;
  let skipped = 0;

  for (const entry of subscribers) {
    const email = sanitizeString(entry?.email).toLowerCase();
    if (!email || !isValidEmail(email)) { skipped++; continue; }
    if (await findSubscriberByEmail(email)) { skipped++; continue; }
    await addSubscriber(email, entry?.name ? sanitizeString(entry.name, 200) : undefined, 'admin_import');
    imported++;
  }

  appendAudit({ event: 'admin_newsletter_subscribers_imported', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { imported, skipped } });

  return res.json({ ok: true, imported, skipped });
}
