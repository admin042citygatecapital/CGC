/**
 * emailQueue.ts — PostgreSQL-backed email queue with auto-retry.
 * ──────────────────────────────────────────────────────────────
 * Uses the `email_queue` table in Neon PostgreSQL.
 * Falls back to in-memory no-op when DATABASE_URL is not set
 * (dev without DB — emails are sent directly, no queue).
 *
 * The exported interface is identical to the previous flat-file
 * implementation so all call-sites remain unchanged.
 */

import crypto from 'node:crypto';
import { eq, inArray, or, desc } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { emailQueue as emailQueueTable } from '../db/schema.js';

export type EmailStatus = 'queued' | 'sent' | 'failed' | 'retrying';

export interface QueuedEmail {
  id:            string;
  to:            string;
  subject:       string;
  html:          string;
  status:        EmailStatus;
  attempts:      number;
  maxAttempts:   number;
  errorMessage:  string;
  createdAt:     string;
  lastAttemptAt: string;
  sentAt:        string;
}

const MAX_ATTEMPTS      = 5;
const RETRY_INTERVAL_MS = 60_000;

// ── DB row → QueuedEmail ──────────────────────────────────────────────────────

function rowToEmail(row: typeof emailQueueTable.$inferSelect): QueuedEmail {
  return {
    id:            row.id,
    to:            row.to,
    subject:       row.subject,
    html:          row.html,
    status:        (row.status as EmailStatus) ?? 'queued',
    attempts:      row.attempts,
    maxAttempts:   row.maxAttempts,
    errorMessage:  row.lastError ?? '',
    createdAt:     row.createdAt?.toISOString() ?? new Date().toISOString(),
    lastAttemptAt: row.scheduledAt?.toISOString() ?? '',
    sentAt:        row.sentAt?.toISOString() ?? '',
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Add an email to the queue. Returns the queued record. */
export async function enqueueEmail(payload: { to: string; subject: string; html: string }): Promise<QueuedEmail> {
  const record: QueuedEmail = {
    id:            crypto.randomUUID(),
    to:            payload.to,
    subject:       payload.subject,
    html:          payload.html,
    status:        'queued',
    attempts:      0,
    maxAttempts:   MAX_ATTEMPTS,
    errorMessage:  '',
    createdAt:     new Date().toISOString(),
    lastAttemptAt: '',
    sentAt:        '',
  };

  if (!isDatabaseConfigured()) return record; // dev no-op

  const db = getDb();
  await db.insert(emailQueueTable).values({
    id:          record.id,
    to:          record.to,
    subject:     record.subject,
    html:        record.html,
    status:      'queued',
    attempts:    0,
    maxAttempts: MAX_ATTEMPTS,
  });

  return record;
}

/** Get all email log entries (sent + failed), newest first */
export async function getEmailLogs(limit = 200): Promise<QueuedEmail[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(emailQueueTable)
    .where(inArray(emailQueueTable.status, ['sent', 'failed', 'cancelled']))
    .orderBy(desc(emailQueueTable.createdAt))
    .limit(limit);
  return rows.map(rowToEmail);
}

/** Get pending queue (queued + retrying) */
export async function getPendingQueue(): Promise<QueuedEmail[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(emailQueueTable)
    .where(or(
      eq(emailQueueTable.status, 'queued'),
      eq(emailQueueTable.status, 'sending'),
    ))
    .orderBy(emailQueueTable.scheduledAt);
  return rows.map(rowToEmail);
}

/** Get queue stats */
export async function getQueueStats(): Promise<{ queued: number; retrying: number; sent: number; failed: number; lastSentAt: string }> {
  if (!isDatabaseConfigured()) return { queued: 0, retrying: 0, sent: 0, failed: 0, lastSentAt: '' };
  const db = getDb();
  const rows = await db.select().from(emailQueueTable);
  const queued   = rows.filter(r => r.status === 'queued').length;
  const retrying = rows.filter(r => r.status === 'sending').length;
  const sent     = rows.filter(r => r.status === 'sent').length;
  const failed   = rows.filter(r => r.status === 'failed').length;
  const lastSent = rows
    .filter(r => r.status === 'sent' && r.sentAt)
    .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0))[0];
  return { queued, retrying, sent, failed, lastSentAt: lastSent?.sentAt?.toISOString() ?? '' };
}

/** Mark a queued email as sent */
export async function markEmailSent(id: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db.update(emailQueueTable)
    .set({ status: 'sent', sentAt: new Date() })
    .where(eq(emailQueueTable.id, id));
}

/** Mark a queued email as failed */
export async function markEmailFailed(id: string, errorMessage: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db.update(emailQueueTable)
    .set({ status: 'failed', lastError: errorMessage })
    .where(eq(emailQueueTable.id, id));
}

/** Update a queued email in place */
export async function updateQueuedEmail(id: string, patch: Partial<QueuedEmail>): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db.update(emailQueueTable)
    .set({
      status:      patch.status as 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled' | undefined,
      attempts:    patch.attempts,
      lastError:   patch.errorMessage,
      scheduledAt: patch.lastAttemptAt ? new Date(patch.lastAttemptAt) : undefined,
    })
    .where(eq(emailQueueTable.id, id));
}

/** Permanently delete an email from the queue. Returns true if found. */
export async function purgeEmail(id: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const db = getDb();
  const result = await db.delete(emailQueueTable).where(eq(emailQueueTable.id, id));
  return (result.rowCount ?? 0) > 0;
}

/** Purge all failed emails. Returns count removed. */
export async function purgeAllFailed(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDb();
  const result = await db.delete(emailQueueTable).where(eq(emailQueueTable.status, 'failed'));
  return result.rowCount ?? 0;
}

/** Re-queue a failed email for manual retry */
export async function requeueEmail(id: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const db = getDb();
  const result = await db.update(emailQueueTable)
    .set({ status: 'queued', attempts: 0, lastError: null })
    .where(eq(emailQueueTable.id, id));
  return (result.rowCount ?? 0) > 0;
}

// ── Background retry worker ───────────────────────────────────────────────────

const WORKER_KEY = Symbol.for('cgc.emailQueueWorkerStarted');
declare const globalThis: Record<symbol, boolean | undefined>;

/**
 * Start the background retry worker. Call once at server startup.
 * Safe to call multiple times — idempotent via global flag.
 */
export function startEmailQueueWorker(
  sendFn: (payload: { to: string; subject: string; html: string }) => Promise<{ success: boolean; error?: string; attempts: number; durationMs: number }>
) {
  if (globalThis[WORKER_KEY]) return;
  globalThis[WORKER_KEY] = true;

  async function processQueue() {
    const pending = await getPendingQueue();
    if (pending.length === 0) return;

    console.log(JSON.stringify({ event: 'email.queue.processing', count: pending.length }));

    for (const email of pending) {
      const now = new Date().toISOString();
      await updateQueuedEmail(email.id, {
        status:        'retrying',
        attempts:      email.attempts + 1,
        lastAttemptAt: now,
      });

      try {
        const result = await sendFn({ to: email.to, subject: email.subject, html: email.html });
        if (result.success) {
          await markEmailSent(email.id);
          console.log(JSON.stringify({ event: 'email.queue.sent', id: email.id, to: email.to }));
        } else {
          const attempts = email.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
            await markEmailFailed(email.id, result.error ?? 'Max attempts reached');
            console.error(JSON.stringify({ event: 'email.queue.exhausted', id: email.id, error: result.error }));
          } else {
            await updateQueuedEmail(email.id, { status: 'queued', errorMessage: result.error ?? '' });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const attempts = email.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await markEmailFailed(email.id, msg);
        } else {
          await updateQueuedEmail(email.id, { status: 'queued', errorMessage: msg });
        }
      }
    }
  }

  setInterval(() => {
    processQueue().catch(err =>
      console.error(JSON.stringify({ event: 'email.queue.worker_error', error: String(err) }))
    );
  }, RETRY_INTERVAL_MS);

  setTimeout(() => processQueue().catch(() => {}), 5000);
}
