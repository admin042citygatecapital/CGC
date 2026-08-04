/**
 * POST /api/admin/smtp/test-template
 * Sends a test email using a specific stored template, filled with sample
 * values, to a target address.
 */
import type { Request, Response } from 'express';
import { getTemplate, type TemplateId } from '../../../../lib/emailTemplateStore.js';
import { sendMail } from '../../../../lib/emailService.js';
import { isValidEmail, sanitizeString } from '../../../../lib/inputValidator.js';
import { appendAudit } from '../../../../lib/auditLog.js';

const SAMPLE_VARS: Record<string, string> = {
  user_name: 'John Doe',
  date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  account_number: 'CGC-123456',
  amount: '1,000.00',
  currency: 'USD',
  transaction_id: 'TXN-' + Date.now(),
  recipient_name: 'Jane Smith',
  sender_name: 'John Doe',
  rejection_reason: 'Document was blurry and unreadable.',
  reset_link: 'https://citygate.capital/reset-password?token=sample',
  expiry_time: '30 minutes',
  otp_code: '847291',
  alert_type: 'New login from unrecognised device',
  ip_address: '192.168.1.1',
  location: 'Lagos, Nigeria',
  device: 'Chrome on Windows',
};

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { templateId, to } = req.body as { templateId?: TemplateId; to?: string };

  const safeTo = sanitizeString(to, 200);
  if (!templateId || !safeTo) return res.status(400).json({ ok: false, error: 'templateId and to are required' });
  if (!isValidEmail(safeTo)) return res.status(400).json({ ok: false, error: 'Invalid recipient email' });

  const template = getTemplate(templateId);
  if (!template) return res.status(404).json({ ok: false, error: 'Template not found' });

  const vars: Record<string, string> = { ...SAMPLE_VARS, email: safeTo };
  let subject = template.subject;
  let body = template.body;
  for (const [k, v] of Object.entries(vars)) {
    subject = subject.replaceAll(`{${k}}`, v);
    body = body.replaceAll(`{${k}}`, v);
  }

  const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#111;color:#e5e5e5;padding:32px;border-radius:12px;border:1px solid rgba(201,168,76,0.2)">
  <div style="text-align:center;margin-bottom:24px">
    <span style="font-size:20px;font-weight:700;color:#C9A84C">City Gate Capital</span>
  </div>
  ${body}
  <hr style="margin:32px 0;border-color:rgba(255,255,255,0.1)"/>
  <p style="font-size:11px;color:#555;text-align:center">
    This is a test email sent from the City Gate Capital admin panel.<br/>
    Template: <strong>${template.name}</strong>
  </p>
</div>`;

  const result = await sendMail({ to: safeTo, subject: `[TEST] ${subject}`, html });
  if (!result.success) return res.status(502).json({ ok: false, error: result.error ?? 'Failed to send test email' });

  appendAudit({
    event: 'admin_smtp_test_template_sent',
    adminId: session.adminId,
    email: session.email,
    ip: req.ip ?? 'unknown',
    meta: { templateId, to: safeTo },
  });

  return res.json({ ok: true, message: `Test email sent to ${safeTo}` });
}
