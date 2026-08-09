/**
 * POST /api/contact
 * Accepts a contact form submission and persists it to JSONL.
 * Optionally sends a notification email when SMTP is configured.
 *
 * Body: { firstName, lastName, email, company?, subject, message }
 */
import type { Request, Response } from 'express';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createOperationsItem } from '../../lib/operationsInboxStore.js';
import { requireIntakeEnabled } from '../../lib/operationalControls.js';
import { privateSubdirectory } from '../../lib/storagePaths.js';

const STORE_DIR  = privateSubdirectory('contacts');
const STORE_FILE = join(STORE_DIR, 'submissions.jsonl');

interface ContactSubmission {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  subject: string;
  message: string;
  ip: string;
  userAgent: string;
  createdAt: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Strip HTML tags and control characters to prevent stored XSS */
function sanitize(value: unknown, maxLen = 500): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')          // strip HTML tags
    // eslint-disable-next-line no-control-regex -- intentionally removes unsafe control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
}

export default function handler(req: Request, res: Response) {
  try {
    if (!requireIntakeEnabled(res, 'contactFormsEnabled')) return;
    // ── Sanitize inputs ───────────────────────────────────────────────────────
    const firstName = sanitize(req.body?.firstName, 100);
    const lastName  = sanitize(req.body?.lastName,  100);
    const email     = sanitize(req.body?.email,     254).toLowerCase();
    const company   = sanitize(req.body?.company,   200);
    const subject   = sanitize(req.body?.subject,   200);
    const message   = sanitize(req.body?.message,   5000);

    // ── Validation ────────────────────────────────────────────────────────────
    if (!firstName)  return res.status(400).json({ error: 'First name is required.' });
    if (!lastName)   return res.status(400).json({ error: 'Last name is required.' });
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'A valid email address is required.' });
    if (!subject)    return res.status(400).json({ error: 'Subject is required.' });
    if (!message || message.length < 10) return res.status(400).json({ error: 'Message must be at least 10 characters.' });

    // ── Persist ───────────────────────────────────────────────────────────────
    const submission: ContactSubmission = {
      id:        generateId(),
      firstName,
      lastName,
      email,
      company,
      subject,
      message,
      ip:        req.ip ?? 'unknown',
      userAgent: req.headers['user-agent'] ?? '',
      createdAt: new Date().toISOString(),
    };

    try {
      mkdirSync(STORE_DIR, { recursive: true });
      appendFileSync(STORE_FILE, JSON.stringify(submission) + '\n', 'utf-8');
      createOperationsItem({
        source: 'contact_form', referenceId: submission.id, title: subject, summary: message,
        requesterName: `${firstName} ${lastName}`, requesterEmail: email,
        metadata: { company: company || 'not provided' },
      });
    } catch (fsErr) {
      console.error('contact.store.write-failed', fsErr);
      // Don't fail the request for a storage error — still return success to user
    }

    console.log('contact.submission', {
      id:      submission.id,
      email:   submission.email,
      subject: submission.subject,
    });

    return res.status(201).json({
      ok: true,
      id: submission.id,
      message: 'Thank you for reaching out. We\'ll be in touch within 1 business day.',
    });
  } catch (err) {
    console.error('contact.handler.error', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
