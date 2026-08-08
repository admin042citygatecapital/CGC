/**
 * emailService.ts — Zoho Mail HTTP API transport
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY HTTP INSTEAD OF SMTP
 * The production container blocks all outbound TCP on ports 587 and 465.
 * HTTPS (443) is always open, so we POST directly to Zoho's Mail Send API.
 *
 * ENDPOINT
 *   POST https://mail.zoho.com/api/accounts/{ZOHO_ACCOUNT_ID}/messages
 *
 * AUTH — tried in order, first available wins:
 *   1. ZOHO_ACCESS_TOKEN  (static OAuth token — legacy / manual)
 *   2. ZOHO_REFRESH_TOKEN + ZOHO_CLIENT_SECRET (auto-refresh OAuth — recommended)
 *   3. ZOHO_SMTP_PASSWORD (Basic auth — NOT supported by Zoho REST API, kept for config display only)
 *
 * REQUIRED SECRETS (Settings → Secrets)
 *   ZOHO_ACCOUNT_ID    — numeric account ID from mail.zoho.com URL
 *   ZOHO_CLIENT_SECRET — from api-console.zoho.com
 *   ZOHO_REFRESH_TOKEN — obtained via OAuth callback flow in Admin → Security → Health
 *
 * RESILIENCE
 *   • Retries up to MAX_RETRIES times with exponential back-off
 *   • 401 invalidates token cache and retries once with a fresh token
 *   • Never throws — logs and returns so callers are never broken
 *   • Structured JSON logs: email.sent / email.retry / email.failed
 */

import { getSecret } from '#airo/secrets';
import { getValidAccessToken, invalidateTokenCache, getResolvedAccountId } from './zohoTokenStore.js';
import { sendEmail as smtpSend } from './smtpTransport.js';
import { enqueueEmail } from './emailQueue.js';
import { escapeEmailHtml, renderBrandedEmail, websiteButton } from './emailLayout.js';
import { getTemplate, renderTemplate, type TemplateId } from './emailTemplateStore.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const FROM_ADDRESS  = 'info@citygate.capital';
const ZOHO_API_BASE = 'https://mail.zoho.com/api/accounts';
const MAX_RETRIES   = 3;
const RETRY_BASE_MS = 800; // doubles each attempt: 800 → 1600 → 3200

// ─── Auth header resolution ───────────────────────────────────────────────────

async function resolveAuthHeader(): Promise<string | null> {
  // 1. Static OAuth token (manual / legacy)
  const staticToken = getSecret('ZOHO_ACCESS_TOKEN');
  if (staticToken) return `Zoho-oauthtoken ${staticToken}`;

  // 2. Auto-refresh OAuth (recommended path)
  const refreshedToken = await getValidAccessToken();
  if (refreshedToken) return `Zoho-oauthtoken ${refreshedToken}`;

  // 3. No valid auth available
  return null;
}

// ─── Core HTTP transport with retry ──────────────────────────────────────────

interface MailPayload {
  to: string;
  subject: string;
  html: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  attempts: number;
  durationMs: number;
}

export async function sendMail(payload: MailPayload): Promise<SendResult> {
  const { to, subject, html } = payload;
  const t0 = Date.now();

  const accountId = getResolvedAccountId();
  let authHeader = await resolveAuthHeader();

  if (!accountId) {
    const msg = 'email.skipped — ZOHO_ACCOUNT_ID not configured';
    console.warn(msg, { to, subject });
    return { success: false, error: msg, attempts: 0, durationMs: 0 };
  }

  if (!authHeader) {
    const msg = 'email.skipped — no auth configured (add ZOHO_REFRESH_TOKEN + ZOHO_CLIENT_SECRET in Settings → Secrets)';
    console.warn(msg, { to, subject });
    return { success: false, error: msg, attempts: 0, durationMs: 0 };
  }

  const url  = `${ZOHO_API_BASE}/${accountId}/messages`;
  const bodyObj = {
    fromAddress: FROM_ADDRESS,
    toAddress:   to,
    subject,
    content:     html,
    mailFormat:  'html',
  };
  const body = JSON.stringify(bodyObj);

  // Log first 300 chars of body for debugging
  console.log(JSON.stringify({
    event:      'email.sending',
    to,
    subject,
    accountId,
    bodyPreview: body.slice(0, 300),
  }));

  let lastError = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type':  'application/json',
          'Accept':        'application/json',
        },
        body,
      });

      // Parse response safely
      const responseText = await res.text().catch(() => '');
      let responseJson: Record<string, unknown> = {};
      try { responseJson = JSON.parse(responseText); } catch { /* not JSON */ }

      // Zoho wraps errors in HTTP 200 — check the inner status code too
      const zohoStatus = (responseJson?.status as Record<string, unknown>)?.code as number | undefined;
      const zohoSuccess = res.ok && (zohoStatus === undefined || zohoStatus === 200);

      if (zohoSuccess) {
        const messageId = (responseJson?.data as Record<string, unknown>)?.messageId as string | undefined;
        console.log(JSON.stringify({
          event:     'email.sent',
          to,
          subject,
          attempt,
          messageId: messageId ?? 'n/a',
          durationMs: Date.now() - t0,
        }));
        return { success: true, messageId, attempts: attempt, durationMs: Date.now() - t0 };
      }

      // Extract Zoho error description if available
      const zohoDesc = (responseJson?.status as Record<string, unknown>)?.description as string | undefined;
      lastError = zohoDesc
        ? `Zoho API ${zohoStatus ?? res.status}: ${zohoDesc}`
        : `Zoho API ${res.status}: ${responseText.slice(0, 200)}`;

      // 401 — token expired or invalid: invalidate cache and retry once with fresh token
      if (res.status === 401) {
        console.warn(JSON.stringify({ event: 'email.token_expired', to, subject, attempt }));
        invalidateTokenCache();
        const freshToken = await resolveAuthHeader();
        if (freshToken) {
          authHeader = freshToken;
          continue; // retry immediately with fresh token, don't count as a retry
        }
        console.error(JSON.stringify({ event: 'email.auth_error', to, subject, status: 401, body: responseText.slice(0, 400) }));
        return { success: false, error: lastError, attempts: attempt, durationMs: Date.now() - t0 };
      }

      // 403 — permission denied, won't recover
      if (res.status === 403) {
        console.error(JSON.stringify({ event: 'email.auth_error', to, subject, status: res.status, body: responseText.slice(0, 400) }));
        return { success: false, error: lastError, attempts: attempt, durationMs: Date.now() - t0 };
      }

      console.warn(JSON.stringify({ event: 'email.retry', to, subject, attempt, error: lastError }));

    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(JSON.stringify({ event: 'email.retry', to, subject, attempt, error: lastError }));
    }

    // Exponential back-off before next attempt
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt - 1)));
    }
  }

  console.error(JSON.stringify({ event: 'email.failed', to, subject, error: lastError, attempts: MAX_RETRIES, durationMs: Date.now() - t0 }));
  return { success: false, error: lastError, attempts: MAX_RETRIES, durationMs: Date.now() - t0 };
}

// Internal fire-and-forget wrapper (preserves old call sites)
// Routes through dual-mode transport; on failure, enqueues for retry.
async function send(payload: MailPayload): Promise<void> {
  const result = await smtpSend(payload);
  if (!result.success) {
    // Enqueue for automatic retry (fire-and-forget)
    enqueueEmail(payload).catch(() => {});
    console.warn(JSON.stringify({
      event:   'email.queued_for_retry',
      to:      payload.to,
      subject: payload.subject,
      error:   result.error,
    }));
  }
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function goldButton(text: string, url: string): string {
  return websiteButton(text, url);
}

function emailWrapper(title: string, bodyHtml: string): string {
  return renderBrandedEmail({ title, bodyHtml });
}

function configuredTemplate(
  id: TemplateId,
  vars: Record<string, string>,
  fallback: { subject: string; title: string; body: string },
): { subject: string; html: string } {
  const template = getTemplate(id);
  if (!template) return { subject: fallback.subject, html: emailWrapper(fallback.title, fallback.body) };
  const safeVars = Object.fromEntries(Object.entries(vars).map(([key, value]) => [key, escapeEmailHtml(String(value))]));
  const rendered = renderTemplate(template, safeVars);
  return { subject: rendered.subject, html: emailWrapper(template.name, rendered.body) };
}

function parseUaShort(ua: string): string {
  let browser = 'Browser';
  let os = 'Unknown OS';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Edg\//.test(ua)) browser = 'Edge';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  return `${browser} on ${os}`;
}

// ─── Transactional email functions ───────────────────────────────────────────

export async function sendVerificationEmail(to: string, name: string, token: string, baseUrl: string) {
  const url = `${baseUrl}/verify-email?token=${token}`;
  await send({
    to,
    subject: 'Verify Your Email — City Gate Capital',
    html: emailWrapper('Verify Your Email Address',
      `<p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;">Dear <strong style="color:#fff;">${name}</strong>,</p>
       <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;">Thank you for registering with City Gate Capital. Please verify your email address to continue your account setup.</p>
       <p style="margin:28px 0;">${goldButton('Verify Email Address', url)}</p>
       <p style="color:rgba(255,255,255,0.4);font-size:13px;">This link expires in 24 hours. If you did not register, please ignore this email.</p>`
    ),
  });
}

export async function sendWelcomeEmail(to: string, name: string) {
  const content = configuredTemplate('welcome', {
    user_name: name,
    email: to,
    date: new Date().toLocaleDateString('en-GB'),
    account_number: 'Available in your secure dashboard',
  }, {
    subject: 'Welcome to City Gate Capital — Account Under Review',
    title: 'Welcome to City Gate Capital',
    body: `<p>Dear ${escapeEmailHtml(name)},</p><p>Your email has been verified and your account is under review.</p>`,
  });
  await send({ to, ...content });
}

export async function sendApprovalEmail(to: string, name: string) {
  const content = configuredTemplate('kyc_approved', {
    user_name: name,
    date: new Date().toLocaleDateString('en-GB'),
    account_number: 'Available in your secure dashboard',
  }, {
    subject: 'Account Approved — Welcome to City Gate Capital',
    title: 'Your Account Has Been Approved',
    body: `<p>Dear ${escapeEmailHtml(name)},</p><p>Your account has been approved.</p>`,
  });
  await send({ to, ...content });
}

export async function sendRejectionEmail(to: string, name: string, reason: string) {
  const content = configuredTemplate('kyc_rejected', {
    user_name: name,
    rejection_reason: reason,
    date: new Date().toLocaleDateString('en-GB'),
  }, {
    subject: 'City Gate Capital — Application Status Update',
    title: 'Account Application Update',
    body: `<p>Dear ${escapeEmailHtml(name)},</p><p>Your application could not be approved.</p><p><strong>Reason:</strong> ${escapeEmailHtml(reason)}</p>`,
  });
  await send({ to, ...content });
}

export async function sendAdminNewUserAlert(adminEmail: string, user: { name: string; email: string; country?: string; ip?: string }) {
  await send({
    to: adminEmail,
    subject: `New Registration: ${user.name} — City Gate Capital`,
    html: emailWrapper('New User Registration',
      `<p style="color:rgba(255,255,255,0.7);font-size:15px;">A new user has registered and is awaiting KYC review:</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0;">
         ${[
           ['Name',    user.name],
           ['Email',   user.email],
           ['Country', user.country ?? '—'],
           ['IP',      user.ip ?? '—'],
           ['Time',    new Date().toUTCString()],
         ].map(([k, v]) =>
           `<tr>
             <td style="color:rgba(255,255,255,0.4);font-size:13px;padding:6px 0;width:120px;">${k}</td>
             <td style="color:#fff;font-size:13px;padding:6px 0;">${v}</td>
           </tr>`
         ).join('')}
       </table>
       <p style="margin:24px 0;">${goldButton('Review in Admin Panel', 'https://citygate.capital/admin/users')}</p>`
    ),
  });
}

export async function sendPasswordResetEmail(to: string, name: string, token: string, baseUrl: string) {
  const url = `${baseUrl}/reset-password?token=${token}`;
  const content = configuredTemplate('password_reset', {
    user_name: name,
    reset_link: url,
    expiry_time: '1 hour',
    date: new Date().toLocaleDateString('en-GB'),
  }, {
    subject: 'Reset Your Password — City Gate Capital',
    title: 'Reset Your Password',
    body: `<p>Dear ${escapeEmailHtml(name)},</p><p>${goldButton('Reset Password', url)}</p>`,
  });
  await send({ to, ...content });
}

export async function sendAdminOtpEmail(to: string, name: string, otp: string, ip: string, ua: string) {
  const deviceLabel = parseUaShort(ua);
  await send({
    to,
    subject: '🔐 Admin Login Verification Code — City Gate Capital',
    html: emailWrapper('Your Admin Verification Code',
      `<p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;">Hello <strong style="color:#fff;">${name}</strong>,</p>
       <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;">A login attempt was made to the City Gate Capital Admin Panel. Use the code below to complete verification.</p>
       <div style="margin:28px 0;text-align:center;">
         <div style="display:inline-block;background:linear-gradient(135deg,rgba(201,168,76,0.15),rgba(201,168,76,0.05));border:1px solid rgba(201,168,76,0.3);border-radius:16px;padding:24px 40px;">
           <p style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 12px;">Verification Code</p>
           <p style="color:#C9A84C;font-size:42px;font-weight:800;letter-spacing:0.3em;margin:0;font-family:monospace;">${otp}</p>
           <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:12px 0 0;">Expires in 60 seconds</p>
         </div>
       </div>
       <table style="width:100%;border-collapse:collapse;margin:20px 0;">
         <tr>
           <td style="color:rgba(255,255,255,0.4);font-size:12px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">IP Address</td>
           <td style="color:rgba(255,255,255,0.7);font-size:12px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;">${ip}</td>
         </tr>
         <tr>
           <td style="color:rgba(255,255,255,0.4);font-size:12px;padding:6px 0;">Device</td>
           <td style="color:rgba(255,255,255,0.7);font-size:12px;padding:6px 0;text-align:right;">${deviceLabel}</td>
         </tr>
       </table>
       <p style="color:rgba(255,255,255,0.4);font-size:13px;line-height:1.6;">
         <strong style="color:rgba(255,100,100,0.8);">If you did not attempt to log in</strong>,
         your credentials may be compromised. Change your password immediately.
       </p>`
    ),
  });
}

export async function sendAdminLoginAlertEmail(
  to: string,
  name: string,
  ip: string,
  ua: string,
  deviceName?: string,
  isTrustedDevice = false,
) {
  const device  = deviceName ?? parseUaShort(ua);
  const subject = isTrustedDevice
    ? 'Admin Login — Trusted Device — City Gate Capital'
    : '🔔 New Admin Login Detected — City Gate Capital';

  await send({
    to,
    subject,
    html: emailWrapper(
      isTrustedDevice ? 'Admin Login via Trusted Device' : 'New Admin Login Detected',
      `<p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;">Hello <strong style="color:#fff;">${name}</strong>,</p>
       <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;">A successful login to the City Gate Capital Admin Panel was recorded.</p>
       <table style="width:100%;border-collapse:collapse;margin:20px 0;">
         <tr>
           <td style="color:rgba(255,255,255,0.4);font-size:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Time</td>
           <td style="color:rgba(255,255,255,0.7);font-size:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;">${new Date().toUTCString()}</td>
         </tr>
         <tr>
           <td style="color:rgba(255,255,255,0.4);font-size:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">IP Address</td>
           <td style="color:rgba(255,255,255,0.7);font-size:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;">${ip}</td>
         </tr>
         <tr>
           <td style="color:rgba(255,255,255,0.4);font-size:12px;padding:8px 0;">Device</td>
           <td style="color:rgba(255,255,255,0.7);font-size:12px;padding:8px 0;text-align:right;">${device}</td>
         </tr>
       </table>
       <p style="color:rgba(255,255,255,0.4);font-size:13px;line-height:1.6;">
         <strong style="color:rgba(255,100,100,0.8);">If this was not you</strong>,
         terminate all sessions immediately from the Security panel and change your password.
       </p>`
    ),
  });
}

export async function sendAdminFailedOtpAlertEmail(
  to: string,
  name: string,
  ip: string,
  ua: string,
  attempts: number,
) {
  await send({
    to,
    subject: '⚠️ Failed 2FA Attempts Detected — City Gate Capital',
    html: emailWrapper('Failed 2FA Attempt Alert',
      `<p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;">Hello <strong style="color:#fff;">${name}</strong>,</p>
       <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;">There have been <strong style="color:#C9A84C;">${attempts} failed 2FA verification attempt${attempts === 1 ? '' : 's'}</strong> on your admin account.</p>
       <table style="width:100%;border-collapse:collapse;margin:20px 0;">
         <tr>
           <td style="color:rgba(255,255,255,0.4);font-size:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Time</td>
           <td style="color:rgba(255,255,255,0.7);font-size:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;">${new Date().toUTCString()}</td>
         </tr>
         <tr>
           <td style="color:rgba(255,255,255,0.4);font-size:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">IP Address</td>
           <td style="color:rgba(255,255,255,0.7);font-size:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:right;">${ip}</td>
         </tr>
         <tr>
           <td style="color:rgba(255,255,255,0.4);font-size:12px;padding:8px 0;">Device</td>
           <td style="color:rgba(255,255,255,0.7);font-size:12px;padding:8px 0;text-align:right;">${parseUaShort(ua)}</td>
         </tr>
       </table>
       <p style="color:rgba(255,255,255,0.4);font-size:13px;">
         If this was not you, your password may be compromised. Review your account security immediately.
       </p>`
    ),
  });
}

/**
 * sendOtpEmail — alias for sendAdminOtpEmail for use by override panel
 * and any non-admin OTP flows that need a simpler signature.
 */
export async function sendOtpEmail(to: string, name: string, otp: string) {
  const content = configuredTemplate('two_fa_code', {
    user_name: name,
    otp_code: otp,
    expiry_time: '10 minutes',
    date: new Date().toLocaleDateString('en-GB'),
  }, {
    subject: 'Your Verification Code — City Gate Capital',
    title: 'Your Verification Code',
    body: `<p>Hello ${escapeEmailHtml(name)},</p><p>Your verification code is <strong>${escapeEmailHtml(otp)}</strong>.</p>`,
  });
  await send({ to, ...content });
}

/**
 * sendAdminPasswordResetEmail
 *
 * Sends a password-reset link to the registered admin email.
 * The raw token is embedded in the URL — it is NEVER logged here.
 * The link points to /admin/reset-password?token=<raw>
 */
export async function sendAdminPasswordResetEmail(
  to: string,
  name: string,
  rawToken: string,
  ip: string,
  expiryMinutes: number,
) {
  const resetUrl = `https://citygate.capital/admin/reset-password?token=${encodeURIComponent(rawToken)}`;
  await send({
    to,
    subject: '🔐 Admin Password Reset — City Gate Capital',
    html: emailWrapper('Admin Password Reset Request',
      `<p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;">Hello <strong style="color:#fff;">${name}</strong>,</p>
       <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;">A password reset was requested for the City Gate Capital Admin Panel from IP <strong style="color:#C9A84C;">${ip}</strong>.</p>
       <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;">Click the button below to set a new admin password. This link is <strong style="color:#fff;">single-use</strong> and expires in <strong style="color:#fff;">${expiryMinutes} minutes</strong>.</p>
       <p style="margin:32px 0;">${goldButton('Reset Admin Password', resetUrl)}</p>
       <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px 20px;margin:24px 0;">
         <p style="color:rgba(239,68,68,0.9);font-size:13px;margin:0;font-weight:600;">⚠ Security Notice</p>
         <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:8px 0 0;line-height:1.6;">
           If you did not request this reset, your credentials may be compromised.
           Do not click the link. Secure your account immediately.
         </p>
       </div>
       <p style="color:rgba(255,255,255,0.3);font-size:12px;">This link will expire at ${new Date(Date.now() + expiryMinutes * 60_000).toUTCString()}.</p>`
    ),
  });
}

export async function sendBalanceAdjustmentEmail(  to: string,
  name: string,
  type: 'credit' | 'debit',
  amount: number,
  previousBalance: number,
  newBalance: number,
  note: string,
) {
  const isCredit    = type === 'credit';
  const amountFmt   = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const prevFmt     = previousBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const newFmt      = newBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const actionColor = isCredit ? '#10B981' : '#EF4444';
  const actionLabel = isCredit ? 'Credited' : 'Debited';

  await send({
    to,
    subject: `Balance Updated — City Gate Capital`,
    html: emailWrapper('Account Balance Updated',
      `<p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;">Dear <strong style="color:#fff;">${name}</strong>,</p>
       <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;">Your City Gate Capital account balance has been updated by our finance team.</p>
       <div style="background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.2);border-radius:12px;padding:20px 24px;margin:24px 0;">
         <table style="width:100%;border-collapse:collapse;">
           <tr>
             <td style="color:rgba(255,255,255,0.5);font-size:13px;padding:6px 0;">Transaction Type</td>
             <td style="color:${actionColor};font-size:14px;font-weight:600;text-align:right;">${actionLabel}</td>
           </tr>
           <tr>
             <td style="color:rgba(255,255,255,0.5);font-size:13px;padding:6px 0;">Amount</td>
             <td style="color:#fff;font-size:14px;font-weight:600;text-align:right;">${isCredit ? '+' : '-'}${amountFmt} USD</td>
           </tr>
           <tr>
             <td style="color:rgba(255,255,255,0.5);font-size:13px;padding:6px 0;">Previous Balance</td>
             <td style="color:rgba(255,255,255,0.7);font-size:14px;text-align:right;">${prevFmt} USD</td>
           </tr>
           <tr style="border-top:1px solid rgba(255,255,255,0.08);">
             <td style="color:rgba(255,255,255,0.5);font-size:13px;padding:10px 0 6px;">New Balance</td>
             <td style="color:#C9A84C;font-size:16px;font-weight:700;text-align:right;padding:10px 0 6px;">${newFmt} USD</td>
           </tr>
         </table>
         ${note ? `<p style="color:rgba(255,255,255,0.4);font-size:12px;margin:12px 0 0;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;">Note: ${note}</p>` : ''}
       </div>
       <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;">If you have questions about this adjustment, please contact our support team.</p>
       <p style="margin:28px 0;">${goldButton('View Your Account', 'https://citygate.capital/dashboard')}</p>
       <p style="color:rgba(255,255,255,0.4);font-size:13px;">For support: <a href="mailto:support@citygate.capital" style="color:#C9A84C;">support@citygate.capital</a></p>`
    ),
  });
}
