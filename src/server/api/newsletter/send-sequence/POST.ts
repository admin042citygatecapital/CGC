/**
 * POST /api/newsletter/send-sequence
 *
 * Processes the nurture sequence queue:
 * - Finds all active subscribers whose next step is due
 * - Logs the email that would be sent (real SMTP can be wired via the email skill)
 * - Advances the subscriber's sequenceStep (tracked in a local JSONL log)
 *
 * In production, call this endpoint via a cron job or scheduled task.
 */
import type { Request, Response } from 'express';
import { getActiveSubscribers } from '../../../lib/subscriberStore.js';
import { NURTURE_SEQUENCE } from '../../../lib/nurtureSequence.js';
import fs from 'node:fs';
import path from 'node:path';
import { privateSubdirectory } from '../../../lib/storagePaths.js';
import { authorizeAdminPermission } from '../../../lib/rbacMiddleware.js';

const SEQUENCE_LOG_DIR = privateSubdirectory('newsletter');
const STEP_LOG_FILE    = path.join(SEQUENCE_LOG_DIR, 'sequence-steps.json');
const SENT_LOG_FILE    = path.join(SEQUENCE_LOG_DIR, 'sent-log.jsonl');

interface StepMap { [email: string]: { step: number; lastEmailAt: string } }

function readStepMap(): StepMap {
  try {
    if (fs.existsSync(STEP_LOG_FILE)) return JSON.parse(fs.readFileSync(STEP_LOG_FILE, 'utf8'));
  } catch { /* ignore */ }
  return {};
}

function writeStepMap(map: StepMap): void {
  if (!fs.existsSync(SEQUENCE_LOG_DIR)) fs.mkdirSync(SEQUENCE_LOG_DIR, { recursive: true });
  fs.writeFileSync(STEP_LOG_FILE, JSON.stringify(map, null, 2), 'utf8');
}

interface SendResult {
  email: string;
  step: number;
  subject: string;
  status: 'sent' | 'skipped' | 'completed';
}

export default async function handler(req: Request, res: Response) {
  if (!await authorizeAdminPermission(req, res, 'email.send')) return;
  try {
    const now     = Date.now();
    const stepMap = readStepMap();
    const results: SendResult[] = [];
    const all     = await getActiveSubscribers();

    for (const subscriber of all) {
      const state         = stepMap[subscriber.email];
      const nextStepIndex = state?.step ?? 0;

      if (nextStepIndex >= NURTURE_SEQUENCE.length) {
        results.push({ email: subscriber.email, step: nextStepIndex, subject: '—', status: 'completed' });
        continue;
      }

      const email        = NURTURE_SEQUENCE[nextStepIndex];
      const subscribedMs = new Date(subscriber.subscribedAt).getTime();
      const lastEmailMs  = state?.lastEmailAt ? new Date(state.lastEmailAt).getTime() : subscribedMs;
      const referenceMs  = nextStepIndex === 0 ? subscribedMs : lastEmailMs;
      const dueMs        = referenceMs + email.delayHours * 60 * 60 * 1000;

      if (now < dueMs) {
        results.push({ email: subscriber.email, step: nextStepIndex + 1, subject: email.subject, status: 'skipped' });
        continue;
      }

      // Log the email
      const logEntry = {
        timestamp: new Date().toISOString(),
        to:        subscriber.email,
        name:      subscriber.name,
        step:      email.step,
        subject:   email.subject,
        mode:      'logged',
      };
      try {
        if (!fs.existsSync(SEQUENCE_LOG_DIR)) fs.mkdirSync(SEQUENCE_LOG_DIR, { recursive: true });
        fs.appendFileSync(SENT_LOG_FILE, JSON.stringify(logEntry) + '\n', 'utf8');
      } catch { /* log failure should not block response */ }

      // Advance step
      stepMap[subscriber.email] = { step: nextStepIndex + 1, lastEmailAt: new Date().toISOString() };
      results.push({ email: subscriber.email, step: email.step, subject: email.subject, status: 'sent' });
    }

    writeStepMap(stepMap);

    const sent      = results.filter(r => r.status === 'sent').length;
    const skipped   = results.filter(r => r.status === 'skipped').length;
    const completed = results.filter(r => r.status === 'completed').length;

    return res.json({ ok: true, processed: results.length, sent, skipped, completed, results });
  } catch (err) {
    console.error('newsletter.send-sequence.error', err);
    return res.status(500).json({ error: 'Failed to process sequence' });
  }
}
