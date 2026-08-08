/**
 * POST /api/admin/smtp/test
 * Send a test email using the currently configured transport.
 * Body: { to?: string; type?: 'connectivity' | 'verification' | 'otp' | 'password_reset' | 'transaction' | 'login_alert'; forceMode?: 'oauth' | 'manual' }
 */
import type { Request, Response } from 'express';
import { getEmailDeliveryStatus, sendEmail, type EmailDeliveryStatus } from '../../../../lib/smtpTransport.js';
import { loadSmtpConfig, type SmtpMode } from '../../../../lib/smtpConfigStore.js';
import { escapeEmailHtml, renderBrandedEmail } from '../../../../lib/emailLayout.js';

const EMAIL_TYPES = ['connectivity', 'verification', 'otp', 'password_reset', 'transaction', 'login_alert', 'withdrawal', 'admin_alert'] as const;
type EmailType = typeof EMAIL_TYPES[number];
const SUCCESS_EVENTS = new Set<EmailDeliveryStatus>(['delivered', 'opened', 'clicked']);
const FAILURE_EVENTS = new Set<EmailDeliveryStatus>(['bounced', 'canceled', 'complained', 'failed', 'suppressed']);

async function waitForDelivery(messageId: string): Promise<EmailDeliveryStatus | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 400));
    const result = await getEmailDeliveryStatus(messageId);
    if (result.status && (SUCCESS_EVENTS.has(result.status) || FAILURE_EVENTS.has(result.status))) {
      return result.status;
    }
  }
  return (await getEmailDeliveryStatus(messageId)).status;
}

function buildTestHtml(type: EmailType, to: string): { subject: string; html: string } {
  const safeTo = escapeEmailHtml(to);

  const templates: Record<EmailType, { subject: string; body: string }> = {
    connectivity: {
      subject: '✅ CGC Email Test — Connectivity',
      body: `<h2 style="color:#C9A84C;margin:0 0 12px;">Email Delivery Confirmed</h2>
             <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;">Transport is working correctly. Sent to: <strong>${safeTo}</strong></p>`,
    },
    verification: {
      subject: '🔐 CGC Test — Email Verification',
      body: `<h2 style="color:#C9A84C;margin:0 0 12px;">Verify Your Email Address</h2>
             <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;">This is a test of the email verification flow.</p>
             <a href="#" style="display:inline-block;background:linear-gradient(135deg,#C9A84C,#F0D080);color:#000;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;margin-top:16px;">Verify Email (Test)</a>`,
    },
    otp: {
      subject: '🔑 CGC Test — OTP Code',
      body: `<h2 style="color:#C9A84C;margin:0 0 12px;">Your Verification Code</h2>
             <div style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:12px;padding:20px;text-align:center;margin:16px 0;">
               <p style="color:#C9A84C;font-size:40px;font-weight:800;letter-spacing:0.3em;margin:0;font-family:monospace;">847291</p>
               <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:8px 0 0;">Expires in 60 seconds (test)</p>
             </div>`,
    },
    password_reset: {
      subject: '🔒 CGC Test — Password Reset',
      body: `<h2 style="color:#C9A84C;margin:0 0 12px;">Reset Your Password</h2>
             <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;">This is a test of the password reset email flow.</p>
             <a href="#" style="display:inline-block;background:linear-gradient(135deg,#C9A84C,#F0D080);color:#000;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;margin-top:16px;">Reset Password (Test)</a>`,
    },
    transaction: {
      subject: '💳 CGC Test — Transaction Notification',
      body: `<h2 style="color:#C9A84C;margin:0 0 12px;">Transaction Approved</h2>
             <div style="background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.2);border-radius:10px;padding:16px 20px;margin:16px 0;">
               <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0 0 4px;">Amount</p>
               <p style="color:#10B981;font-size:22px;font-weight:700;margin:0;">+$1,000.00 USD (Test)</p>
             </div>`,
    },
    login_alert: {
      subject: '🔔 CGC Test — Admin Login Alert',
      body: `<h2 style="color:#C9A84C;margin:0 0 12px;">New Admin Login Detected</h2>
             <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;">A test login alert from 127.0.0.1 on Chrome / macOS.</p>`,
    },
    withdrawal: {
      subject: '💸 CGC Test — Withdrawal Notification',
      body: `<h2 style="color:#C9A84C;margin:0 0 12px;">Withdrawal Request</h2>
             <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;">Test withdrawal notification for $500.00 USD.</p>`,
    },
    admin_alert: {
      subject: '⚠️ CGC Test — Admin Security Alert',
      body: `<h2 style="color:#EF4444;margin:0 0 12px;">Security Alert (Test)</h2>
             <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;">This is a test of the admin security alert email.</p>`,
    },
  };

  const t = templates[type] ?? templates.connectivity;
  return {
    subject: t.subject,
    html: renderBrandedEmail({
      title: t.subject.replace(/^\S+\s+CGC Test\s+—\s+/, '').replace(/^CGC Email Test\s+—\s+/, ''),
      bodyHtml: t.body,
      testLabel: `Admin delivery test · ${new Date().toUTCString()}`,
    }),
  };
}

export default async function handler(req: Request, res: Response) {
  const { to = 'admin@citygate.capital', type = 'connectivity', forceMode } = req.body as {
    to?: string;
    type?: EmailType;
    forceMode?: SmtpMode;
  };

  const cfg = loadSmtpConfig();
  const t0  = Date.now();

  const { subject, html } = buildTestHtml((EMAIL_TYPES.includes(type as EmailType) ? type : 'connectivity') as EmailType, to);

  try {
    const result = await sendEmail({ to, subject, html }, forceMode);
    const deliveryStatus = result.success && result.messageId
      ? await waitForDelivery(result.messageId)
      : null;
    const failedDelivery = deliveryStatus ? FAILURE_EVENTS.has(deliveryStatus) : false;
    const delivered = deliveryStatus ? SUCCESS_EVENTS.has(deliveryStatus) : false;
    const ok = result.success && !failedDelivery;
    const message = failedDelivery
      ? `Provider reported ${deliveryStatus} for ${to}`
      : delivered
        ? `Test email delivered to ${to}`
        : result.success
          ? `Test email accepted by Resend for ${to}; final status is ${deliveryStatus ?? 'pending'}`
          : (result.error ?? 'Delivery failed');

    return res.status(ok ? (delivered ? 200 : 202) : 502).json({
      ok,
      message,
      transport:  result.transport,
      deliveryStatus,
      mode:       cfg.mode,
      durationMs: result.durationMs,
      attempts:   result.attempts,
      messageId:  result.messageId,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t0,
    });
  }
}
