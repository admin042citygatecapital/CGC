/**
 * POST /api/admin/smtp/test-template
 * Send a test email using a specific template to the admin's email.
 */
import type { Request, Response } from 'express';
import { getTemplate, type TemplateId } from '../../../../lib/emailTemplateStore.js';
import { sendMail } from '../../../../lib/emailService.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { templateId, to } = req.body as { templateId: TemplateId; to: string };
    if (!templateId || !to) return res.status(400).json({ error: 'templateId and to required' });

    const template = getTemplate(templateId);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Fill all variables with sample values
    const sampleVars: Record<string, string> = {
      user_name:        'John Doe',
      email:            to,
      date:             new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      account_number:   'CGC-123456',
      amount:           '1,000.00',
      currency:         'USD',
      transaction_id:   'TXN-' + Date.now(),
      recipient_name:   'Jane Smith',
      sender_name:      'John Doe',
      rejection_reason: 'Document was blurry and unreadable.',
      reset_link:       'https://citygate.capital/reset-password?token=sample',
      expiry_time:      '30 minutes',
      otp_code:         '847291',
      alert_type:       'New login from unrecognised device',
      ip_address:       '192.168.1.1',
      location:         'Lagos, Nigeria',
      device:           'Chrome on Windows',
    };

    let subject = template.subject;
    let body    = template.body;
    for (const [k, v] of Object.entries(sampleVars)) {
      subject = subject.replaceAll(`{${k}}`, v);
      body    = body.replaceAll(`{${k}}`, v);
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

    await sendMail({ to, subject: `[TEST] ${subject}`, html });
    return res.json({ ok: true, message: `Test email sent to ${to}` });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
