/** Durable public contact intake. */
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { createOperationsItem } from '../../lib/operationsInboxStore.js';
import { requireIntakeEnabled } from '../../lib/operationalControls.js';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(value: unknown, maxLen = 500): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex -- intentionally removes unsafe control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
}

export default async function handler(req: Request, res: Response) {
  try {
    if (!requireIntakeEnabled(res, 'contactFormsEnabled')) return;
    const firstName = sanitize(req.body?.firstName, 100);
    const lastName = sanitize(req.body?.lastName, 100);
    const email = sanitize(req.body?.email, 254).toLowerCase();
    const company = sanitize(req.body?.company, 200);
    const subject = sanitize(req.body?.subject, 200);
    const message = sanitize(req.body?.message, 2_000);

    if (!firstName) return res.status(400).json({ error: 'First name is required.' });
    if (!lastName) return res.status(400).json({ error: 'Last name is required.' });
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'A valid email address is required.' });
    if (!subject) return res.status(400).json({ error: 'Subject is required.' });
    if (message.length < 10) return res.status(400).json({ error: 'Message must be at least 10 characters.' });

    const submissionId = `contact_${crypto.randomBytes(12).toString('hex')}`;
    await createOperationsItem({
      source: 'contact_form',
      referenceId: submissionId,
      title: subject,
      summary: message,
      requesterName: `${firstName} ${lastName}`,
      requesterEmail: email,
      metadata: { firstName, lastName, company, requestIp: req.ip ?? 'unknown' },
    });

    console.log('contact.submission', { id: submissionId, event: 'accepted' });
    return res.status(201).json({
      ok: true,
      id: submissionId,
      message: 'Thank you for reaching out. Your message has been received.',
    });
  } catch (error) {
    console.error('contact.handler.error', error instanceof Error ? error.message : 'unknown');
    return res.status(500).json({ error: 'We could not submit your message. Please try again.' });
  }
}
