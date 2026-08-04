/**
 * POST /api/newsletter/send-sequence
 *
 * Processes the nurture sequence queue:
 * - Finds all active subscribers whose next step is due
 * - Logs the email that would be sent (real SMTP can be wired via the email skill)
 * - Advances the subscriber's sequenceStep
 *
 * In production, call this endpoint via a cron job or scheduled task.
 * For demo/preview, call it manually from the /newsletter admin page.
 */
import type { Request, Response } from 'express';
import { getAllSubscribers, updateSequenceStep } from '../../../lib/subscriberStore.js';
import { NURTURE_SEQUENCE } from '../../../lib/nurtureSequence.js';

const SEQUENCE_LOG_DIR = '/private/newsletter';
import fs from 'node:fs';
import path from 'node:path';

interface SendResult {
  email: string;
  step: number;
  subject: string;
  status: 'sent' | 'skipped' | 'completed';
}

export default async function handler(req: Request, res: Response) {
  try {
    const now = Date.now();
    const results: SendResult[] = [];
    const all = (await getAllSubscribers()).filter(s => s.status === 'active');

    for (const subscriber of all) {
      const nextStepIndex = subscriber.sequenceStep; // 0-indexed: 0 = step 1 not yet sent
      if (nextStepIndex >= NURTURE_SEQUENCE.length) {
        results.push({ email: subscriber.email, step: nextStepIndex, subject: '—', status: 'completed' });
        continue;
      }

      const email = NURTURE_SEQUENCE[nextStepIndex];
      const subscribedMs = new Date(subscriber.subscribedAt).getTime();
      const lastEmailMs  = subscriber.lastEmailAt ? new Date(subscriber.lastEmailAt).getTime() : subscribedMs;

      // For step 1 (index 0): send immediately (delayHours = 0)
      // For subsequent steps: wait delayHours after last email
      const referenceMs = nextStepIndex === 0 ? subscribedMs : lastEmailMs;
      const dueMs = referenceMs + email.delayHours * 60 * 60 * 1000;

      if (now < dueMs) {
        results.push({ email: subscriber.email, step: nextStepIndex + 1, subject: email.subject, status: 'skipped' });
        continue;
      }

      // Log the email to /private/newsletter/sent-log.jsonl
      const logEntry = {
        timestamp: new Date().toISOString(),
        to: subscriber.email,
        name: subscriber.name,
        step: email.step,
        subject: email.subject,
        // In production: replace this with actual SMTP send via nodemailer
        // e.g. await transporter.sendMail({ to: subscriber.email, subject: email.subject, html: email.bodyHtml })
        mode: 'logged', // change to 'sent' when SMTP is configured
      };

      try {
        if (!fs.existsSync(SEQUENCE_LOG_DIR)) fs.mkdirSync(SEQUENCE_LOG_DIR, { recursive: true });
        fs.appendFileSync(
          path.join(SEQUENCE_LOG_DIR, 'sent-log.jsonl'),
          JSON.stringify(logEntry) + '\n',
          'utf8'
        );
      } catch { /* log failure should not block response */ }

      // Advance the subscriber's step
      await updateSequenceStep(subscriber.email, nextStepIndex + 1);

      results.push({ email: subscriber.email, step: email.step, subject: email.subject, status: 'sent' });
    }

    const sent     = results.filter(r => r.status === 'sent').length;
    const skipped  = results.filter(r => r.status === 'skipped').length;
    const completed = results.filter(r => r.status === 'completed').length;

    return res.json({ ok: true, processed: results.length, sent, skipped, completed, results });
  } catch (err) {
    console.error('newsletter.send-sequence.error', err);
    return res.status(500).json({ ok: false, error: 'Failed to process sequence' });
  }
}
