/**
 * POST /api/admin/smtp/test-template
 * Send a test email using a specific template to the admin's email.
 */
import type { Request, Response } from 'express';
import { getTemplate, renderTemplate, type TemplateId } from '../../../../lib/emailTemplateStore.js';
import { renderBrandedEmail } from '../../../../lib/emailLayout.js';
import { getEmailDeliveryStatus, sendEmail } from '../../../../lib/smtpTransport.js';

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

    const rendered = renderTemplate(template, sampleVars);
    const html = renderBrandedEmail({
      title: template.name,
      bodyHtml: rendered.body,
      testLabel: `Admin template test: ${template.name}`,
    });

    const result = await sendEmail({ to, subject: `[TEST] ${rendered.subject}`, html });
    if (!result.success) return res.status(502).json({ ok: false, error: result.error ?? 'Delivery provider rejected the email.' });

    let deliveryStatus: string | null = null;
    if (result.messageId) {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 750 : 1_250));
        deliveryStatus = (await getEmailDeliveryStatus(result.messageId)).status;
        if (deliveryStatus && !['queued', 'scheduled', 'sent'].includes(deliveryStatus)) break;
      }
    }

    const failed = ['bounced', 'canceled', 'complained', 'failed', 'suppressed'].includes(deliveryStatus ?? '');
    return res.status(failed ? 502 : 200).json({
      ok: !failed,
      message: failed
        ? `Resend reported ${deliveryStatus} for ${to}`
        : `Template test accepted for ${to}${deliveryStatus ? `; provider status: ${deliveryStatus}` : ''}`,
      messageId: result.messageId,
      deliveryStatus,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
