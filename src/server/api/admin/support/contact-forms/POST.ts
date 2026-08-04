/**
 * POST /api/admin/support/contact-forms
 * Body: { id?: string, ...fields }
 * Updates an existing contact form submission (status, assignedTo, notes,
 * reply) when `id` is given, otherwise logs a new one manually (e.g. a
 * phone-in request an admin wants tracked alongside the web form queue).
 *
 * Note: the public POST /api/contact endpoint writes to its own flat file
 * and does not currently create entries here — see supportExtStore.ts vs.
 * contact/POST.ts. Wiring those together is a separate change.
 */
import type { Request, Response } from 'express';
import { createContactForm, updateContactForm, type ContactFormSubmission } from '../../../../lib/supportExtStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isOneOf } from '../../../../lib/inputValidator.js';

const STATUSES = ['new', 'read', 'replied', 'archived'] as const;

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;

  if (typeof raw.id === 'string' && raw.id) {
    const patch: Partial<ContactFormSubmission> = {};
    if (raw.status !== undefined) {
      const status = isOneOf(raw.status, STATUSES);
      if (!status) return res.status(400).json({ ok: false, error: 'Invalid status' });
      patch.status = status;
    }
    if (typeof raw.assignedTo === 'string') patch.assignedTo = sanitizeString(raw.assignedTo, 100);
    if (typeof raw.notes === 'string') patch.notes = sanitizeString(raw.notes, 5000);
    if (typeof raw.replyBody === 'string') {
      patch.replyBody = sanitizeString(raw.replyBody, 10_000);
      patch.repliedAt = new Date().toISOString();
      patch.status = 'replied';
    }

    const submission = updateContactForm(raw.id, patch);
    if (!submission) return res.status(404).json({ ok: false, error: 'Submission not found' });

    appendAudit({
      event: 'support_contact_form_updated',
      adminId: req.adminSession?.adminId,
      email: req.adminSession?.email,
      ip: req.ip ?? 'unknown',
      meta: { id: submission.id },
    });

    return res.json({ ok: true, submission });
  }

  const name = sanitizeString(raw.name, 200);
  const email = sanitizeString(raw.email, 254);
  const message = sanitizeString(raw.message, 5000);
  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: 'name, email, and message are required' });
  }

  const submission = createContactForm({
    name,
    email,
    phone: sanitizeString(raw.phone, 50),
    subject: sanitizeString(raw.subject, 200),
    message,
    source: sanitizeString(raw.source, 100) || 'admin_manual',
  });

  appendAudit({
    event: 'support_contact_form_created',
    adminId: req.adminSession?.adminId,
    email: req.adminSession?.email,
    ip: req.ip ?? 'unknown',
    meta: { id: submission.id },
  });

  return res.status(201).json({ ok: true, submission });
}
