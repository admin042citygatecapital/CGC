/**
 * smtpTransport.ts — Resend HTTP transport (Vercel / Node / serverless compatible)
 * ─────────────────────────────────────────────────────────────────────────────────
 * Uses Resend's HTTPS REST API via the official `resend` SDK.
 * Pure fetch() — no TCP sockets, no Node.js net/tls — works on Vercel
 * serverless functions, Edge Runtime, and any Node.js environment.
 *
 * Exported interface is identical to the previous Nodemailer implementation so
 * all call-sites (emailService.ts, emailQueue.ts, admin handlers) work
 * without any changes.
 *
 * Required secret:
 *   RESEND_API_KEY — from resend.com/api-keys
 *
 * From address:
 *   Uses EMAIL_* secrets for per-type from addresses.
 *   Falls back to MAIL_FROM_ADDRESS → 'noreply@citygate.capital'.
 *
 * Retry strategy:
 *   Up to MAX_RETRIES attempts with exponential back-off.
 *   429 (rate limit) and 5xx are retried; 4xx (except 429) are not.
 */

import { Resend } from 'resend';
import { getSecret } from '#airo/secrets';
import type { SmtpMode } from './smtpConfigStore.js';

export interface SendResult {
  success:    boolean;
  messageId?: string;
  error?:     string;
  attempts:   number;
  durationMs: number;
  transport:  'resend' | 'none';
}

export type EmailDeliveryStatus =
  | 'bounced' | 'canceled' | 'clicked' | 'complained' | 'delivered'
  | 'delivery_delayed' | 'failed' | 'opened' | 'queued' | 'scheduled'
  | 'sent' | 'suppressed';

const MAX_RETRIES   = 3;
const RETRY_BASE_MS = 800;

// ── Resend client (lazy — instantiated on first use) ─────────────────────────

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (_resend) return _resend;
  const secret = getSecret('RESEND_API_KEY');
  const key = typeof secret === 'string' ? secret : '';
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

function resolveFrom(): string {
  const value = getSecret('MAIL_FROM_ADDRESS');
  return typeof value === 'string' && value ? value : 'noreply@citygate.capital';
}

// ── Core send with retry ──────────────────────────────────────────────────────

export async function sendEmail(
  payload: { to: string; subject: string; html: string; from?: string },
  _forceMode?: SmtpMode,
): Promise<SendResult> {
  const t0     = Date.now();
  const resend = getResend();

  if (!resend) {
    console.error(JSON.stringify({ event: 'email.no_api_key', to: payload.to }));
    return { success: false, error: 'RESEND_API_KEY not configured', attempts: 0, durationMs: 0, transport: 'none' };
  }

  const from    = payload.from ?? resolveFrom();
  const { to, subject, html } = payload;

  let lastError = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await resend.emails.send({ from, to, subject, html });

      if (error) {
        lastError = error.message ?? String(error);
        // 4xx errors (except 429) are not retryable
        const status = (error as { statusCode?: number }).statusCode ?? 0;
        if (status >= 400 && status < 500 && status !== 429) {
          console.error(JSON.stringify({ event: 'email.failed', to, subject, error: lastError, attempt }));
          return { success: false, error: lastError, attempts: attempt, durationMs: Date.now() - t0, transport: 'resend' };
        }
      } else if (data?.id) {
        console.log(JSON.stringify({ event: 'email.sent', to, subject, messageId: data.id, attempt, durationMs: Date.now() - t0 }));
        return { success: true, messageId: data.id, attempts: attempt, durationMs: Date.now() - t0, transport: 'resend' };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < MAX_RETRIES) {
      console.warn(JSON.stringify({ event: 'email.retry', to, attempt, error: lastError }));
      await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt - 1)));
    }
  }

  console.error(JSON.stringify({ event: 'email.failed', to, subject, error: lastError, attempts: MAX_RETRIES }));
  return { success: false, error: lastError, attempts: MAX_RETRIES, durationMs: Date.now() - t0, transport: 'resend' };
}

/**
 * Fetch the provider's latest event for an email accepted by Resend.
 * This is intentionally separate from sendEmail: ordinary application sends
 * remain fast, while the admin test center can verify final delivery.
 */
export async function getEmailDeliveryStatus(
  messageId: string,
): Promise<{ status: EmailDeliveryStatus | null; error?: string }> {
  const resend = getResend();
  if (!resend) return { status: null, error: 'RESEND_API_KEY not configured' };
  try {
    const { data, error } = await resend.emails.get(messageId);
    if (error) return { status: null, error: error.message };
    return { status: data?.last_event ?? null };
  } catch (err) {
    return { status: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Verify transport connectivity — pings Resend API with a domains list call.
 * Used by admin SMTP status/verify endpoints.
 */
export async function verifyManualSmtp(): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: 'RESEND_API_KEY not configured' };
  try {
    const { error } = await resend.domains.list();
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
