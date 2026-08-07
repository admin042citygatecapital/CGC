/**
 * POST /api/admin/smtp/test
 * Send a test email using the currently configured transport.
 * Body: { to?: string; type?: 'connectivity' | 'verification' | 'otp' | 'password_reset' | 'transaction' | 'login_alert'; forceMode?: 'oauth' | 'manual' }
 */
import type { Request, Response } from 'express';
import { sendEmail } from '../../../../lib/smtpTransport.js';
import { loadSmtpConfig, type SmtpMode } from '../../../../lib/smtpConfigStore.js';

const EMAIL_TYPES = ['connectivity', 'verification', 'otp', 'password_reset', 'transaction', 'login_alert', 'withdrawal', 'admin_alert'] as const;
type EmailType = typeof EMAIL_TYPES[number];

function buildTestHtml(type: EmailType, to: string): { subject: string; html: string } {
  const base = `<div style="background:#0A0A0A;font-family:Inter,Arial,sans-serif;padding:40px;border-radius:16px;max-width:560px;margin:auto;color:#fff;">
    <img src="https://citygate.capital/assets/IMG-20260519-WA0000.jpg" height="48" style="height:48px;width:auto;margin-bottom:24px;" alt="City Gate Capital"/>`;
  const footer = `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;"/>
    <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0;">This is a test email from City Gate Capital Admin Panel · ${new Date().toUTCString()}</p></div>`;

  const templates: Record<EmailType, { subject: string; body: string }> = {
    connectivity: {
      subject: '✅ CGC Email Test — Connectivity',
      body: `<h2 style="color:#C9A84C;margin:0 0 12px;">Email Delivery Confirmed</h2>
             <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;">Transport is working correctly. Sent to: <strong>${to}</strong></p>`,
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
  return { subject: t.subject, html: `${base}${t.body}${footer}` };
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
    return res.status(result.success ? 200 : 502).json({
      ok:         result.success,
      message:    result.success ? `Test email delivered to ${to}` : (result.error ?? 'Delivery failed'),
      transport:  result.transport,
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
