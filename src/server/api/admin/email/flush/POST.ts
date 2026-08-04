/**
 * POST /api/admin/email/flush
 * SUPER_ADMIN only.
 *
 * Full email system recovery sequence:
 *   1. Invalidate stale OAuth token cache
 *   2. Attempt fresh token exchange with Zoho
 *   3. Auto-requeue ALL exhausted (failed) emails from the log
 *   4. Flush the entire pending queue (queued + retrying)
 *   5. Return full OAuth diagnosis + queue results
 *
 * Use after updating ZOHO_REFRESH_TOKEN or ZOHO_CLIENT_SECRET in secrets
 * to apply the new credentials without a redeploy.
 */
import type { Request, Response } from 'express';
import {
  invalidateTokenCache,
  getValidAccessToken,
  diagnoseOAuthCredentials,
} from '../../../../lib/zohoTokenStore.js';
import {
  getPendingQueue,
  getQueueStats,
  getEmailLogs,
  updateQueuedEmail,
  markEmailSent,
  markEmailFailed,
  requeueEmail,
} from '../../../../lib/emailQueue.js';
import { sendEmail as smtpSendEmail } from '../../../../lib/smtpTransport.js';

const MAX_ATTEMPTS = 5;

export default async function handler(_req: Request, res: Response) {
  const t0 = Date.now();

  // ── Step 1: Invalidate stale token cache ────────────────────────────────────
  invalidateTokenCache();

  // ── Step 2: Attempt fresh token exchange ────────────────────────────────────
  let newToken: string | null = null;
  let tokenError: string | null = null;
  try {
    newToken = await getValidAccessToken();
    if (!newToken) {
      tokenError = 'Token exchange returned null — check ZOHO_REFRESH_TOKEN and ZOHO_CLIENT_SECRET in Settings → Secrets';
    }
  } catch (err) {
    tokenError = err instanceof Error ? err.message : String(err);
  }

  const oauthDiagnosis = diagnoseOAuthCredentials();

  // ── Step 3: Auto-requeue exhausted emails (skip network-level failures) ──────
  // Only requeue Zoho API errors — not "Connection timeout" which indicates
  // a pre-fix network issue that will not resolve by retrying.
  const failedLogs = (await getEmailLogs(500)).filter(e =>
    e.status === 'failed' &&
    !e.errorMessage?.toLowerCase().includes('connection timeout') &&
    !e.errorMessage?.toLowerCase().includes('network error')
  );
  const requeuedIds: string[] = [];
  for (const email of failedLogs) {
    const ok = await requeueEmail(email.id);
    if (ok) requeuedIds.push(email.id);
  }

  // ── Step 4: Flush the full pending queue ─────────────────────────────────────
  const pending = await getPendingQueue();
  const flushResults: Array<{
    id: string;
    to: string;
    subject: string;
    success: boolean;
    transport?: string;
    error?: string;
  }> = [];

  for (const email of pending) {
    const now = new Date().toISOString();
    await updateQueuedEmail(email.id, {
      status:        'retrying',
      attempts:      email.attempts + 1,
      lastAttemptAt: now,
    });

    try {
      const result = await smtpSendEmail({
        to:      email.to,
        subject: email.subject,
        html:    email.html,
      });

      if (result.success) {
        await markEmailSent(email.id);
        flushResults.push({
          id:        email.id,
          to:        email.to,
          subject:   email.subject,
          success:   true,
          transport: result.transport,
        });
      } else {
        const attempts = email.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await markEmailFailed(email.id, result.error ?? 'Max attempts reached');
        } else {
          await updateQueuedEmail(email.id, { status: 'queued', errorMessage: result.error ?? '' });
        }
        flushResults.push({
          id:        email.id,
          to:        email.to,
          subject:   email.subject,
          success:   false,
          transport: result.transport,
          error:     result.error,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const attempts = email.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await markEmailFailed(email.id, msg);
      } else {
        await updateQueuedEmail(email.id, { status: 'queued', errorMessage: msg });
      }
      flushResults.push({
        id:      email.id,
        to:      email.to,
        subject: email.subject,
        success: false,
        error:   msg,
      });
    }
  }

  const queueStats = await getQueueStats();
  const durationMs = Date.now() - t0;


  return res.json({
    ok:        !!newToken,
    durationMs,
    oauth: {
      tokenRefreshed: !!newToken,
      tokenError,
      ...oauthDiagnosis,
    },
    queue: {
      requeuedExhausted: requeuedIds.length,
      flushed:  pending.length,
      sent:     flushResults.filter(r => r.success).length,
      failed:   flushResults.filter(r => !r.success).length,
      results:  flushResults,
      stats:    queueStats,
    },
  });
}
