/**
 * smtpTransport.ts — server-side HTTP email transport for Node.js / Render
 * ──────────────────────────────────────────────────────────────────────────
 * Uses Resend when configured and falls back to the Zoho Mail API. Both
 * transports use HTTPS and keep provider credentials in the server runtime.
 *
 * Exported interface is identical to the previous Nodemailer implementation so
 * all call-sites (emailService.ts, emailQueue.ts, admin handlers) work
 * without any changes.
 *
 * Provider secrets (configure one provider):
 *   RESEND_API_KEY
 *   or ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ACCOUNT_ID
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
import { getSecret } from '#runtime/secrets';
import type { SmtpMode } from './smtpConfigStore.js';
import type { ProviderVerification } from './emailProviderHealth.js';
import { getResolvedAccountId, getValidAccessToken, invalidateTokenCache } from './zohoTokenStore.js';

export interface SendResult {
  success:    boolean;
  messageId?: string;
  error?:     string;
  attempts:   number;
  durationMs: number;
  transport:  'resend' | 'zoho' | 'none';
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

async function sendWithZoho(
  payload: { to: string; subject: string; html: string; from?: string },
  t0: number,
): Promise<SendResult> {
  const accountId = getResolvedAccountId();
  let accessToken = String(getSecret('ZOHO_ACCESS_TOKEN') || '') || await getValidAccessToken();
  if (!accountId || !accessToken) {
    console.error(JSON.stringify({ event: 'email.provider_unconfigured', provider: 'zoho', to: payload.to }));
    return {
      success: false,
      error: 'No email provider is configured',
      attempts: 0,
      durationMs: Date.now() - t0,
      transport: 'none',
    };
  }

  const url = `https://mail.zoho.com/api/accounts/${encodeURIComponent(accountId)}/messages`;
  const body = JSON.stringify({
    fromAddress: payload.from ?? resolveFrom(),
    toAddress: payload.to,
    subject: payload.subject,
    content: payload.html,
    mailFormat: 'html',
  });
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body,
      });
      const responseText = await response.text().catch(() => '');
      let responseJson: Record<string, unknown> = {};
      try { responseJson = JSON.parse(responseText); } catch { /* provider returned no JSON */ }
      const providerStatus = (responseJson.status as Record<string, unknown> | undefined)?.code as number | undefined;
      if (response.ok && (providerStatus === undefined || providerStatus === 200)) {
        const messageId = (responseJson.data as Record<string, unknown> | undefined)?.messageId as string | undefined;
        console.log(JSON.stringify({
          event: 'email.sent', provider: 'zoho', to: payload.to, messageId: messageId ?? 'n/a',
          attempt, durationMs: Date.now() - t0,
        }));
        return { success: true, messageId, attempts: attempt, durationMs: Date.now() - t0, transport: 'zoho' };
      }

      const description = (responseJson.status as Record<string, unknown> | undefined)?.description;
      lastError = typeof description === 'string'
        ? `Zoho API ${providerStatus ?? response.status}: ${description}`
        : `Zoho API ${response.status}`;

      if (response.status === 401 && attempt < MAX_RETRIES) {
        invalidateTokenCache();
        const refreshed = await getValidAccessToken();
        if (refreshed) {
          accessToken = refreshed;
          continue;
        }
      }
      if (response.status >= 400 && response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < MAX_RETRIES) {
      console.warn(JSON.stringify({ event: 'email.retry', provider: 'zoho', to: payload.to, attempt }));
      await new Promise(resolve => setTimeout(resolve, RETRY_BASE_MS * Math.pow(2, attempt - 1)));
    }
  }

  console.error(JSON.stringify({ event: 'email.failed', provider: 'zoho', to: payload.to, attempts: MAX_RETRIES }));
  return {
    success: false,
    error: lastError || 'Zoho delivery failed',
    attempts: MAX_RETRIES,
    durationMs: Date.now() - t0,
    transport: 'zoho',
  };
}

// ── Core send with retry ──────────────────────────────────────────────────────

export async function sendEmail(
  payload: { to: string; subject: string; html: string; from?: string },
  _forceMode?: SmtpMode,
): Promise<SendResult> {
  const t0     = Date.now();
  const resend = getResend();

  if (!resend) {
    return sendWithZoho(payload, t0);
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
          console.error(JSON.stringify({ event: 'email.failed', provider: 'resend', to, error: lastError, attempt }));
          return { success: false, error: lastError, attempts: attempt, durationMs: Date.now() - t0, transport: 'resend' };
        }
      } else if (data?.id) {
        console.log(JSON.stringify({ event: 'email.sent', provider: 'resend', to, messageId: data.id, attempt, durationMs: Date.now() - t0 }));
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

  console.error(JSON.stringify({ event: 'email.failed', provider: 'resend', to, error: lastError, attempts: MAX_RETRIES }));
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
export async function verifyResendProvider(): Promise<ProviderVerification> {
  const resend = getResend();
  if (!resend) return { status: 'unconfigured' };
  try {
    const { error } = await resend.domains.list();
    if (!error) return { status: 'verified' };
    const statusCode = (error as { statusCode?: number }).statusCode ?? 0;
    if (statusCode === 401) return { status: 'invalid', detail: 'The provider rejected the API credential.' };
    if (statusCode === 403) return { status: 'permission_limited' };
    return { status: 'unavailable', detail: 'The provider verification endpoint is temporarily unavailable.' };
  } catch {
    return { status: 'unavailable', detail: 'The provider verification request could not be completed.' };
  }
}

/** @deprecated Use verifyResendProvider; retained for compatibility with older callers. */
export async function verifyManualSmtp(): Promise<{ ok: boolean; error?: string }> {
  const result = await verifyResendProvider();
  return result.status === 'verified'
    ? { ok: true }
    : { ok: false, error: result.detail ?? result.status };
}
