/**
 * POST /api/admin/email/test
 * Production email-center test using the active Resend HTTPS transport.
 */
import type { Request, Response } from 'express';
import { renderBrandedEmail } from '../../../../lib/emailLayout.js';
import { sendAdminLoginAlertEmail, sendApprovalEmail } from '../../../../lib/emailService.js';
import { getEmailDeliveryStatus, sendEmail, type EmailDeliveryStatus } from '../../../../lib/smtpTransport.js';
import { appendCriticalAudit } from '../../../../lib/auditLog.js';

const FINAL_SUCCESS = new Set<EmailDeliveryStatus>(['delivered', 'opened', 'clicked']);
const FINAL_FAILURE = new Set<EmailDeliveryStatus>(['bounced', 'canceled', 'complained', 'failed', 'suppressed']);

async function waitForFinalEvent(messageId: string): Promise<EmailDeliveryStatus | null> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt) await new Promise(resolve => setTimeout(resolve, 500));
    const status = (await getEmailDeliveryStatus(messageId)).status;
    if (status && (FINAL_SUCCESS.has(status) || FINAL_FAILURE.has(status))) return status;
  }
  return (await getEmailDeliveryStatus(messageId)).status;
}

export default async function handler(req: Request, res: Response) {
  const { to = 'admin@citygate.capital', type = 'connectivity' } = req.body as {
    to?: string;
    type?: 'connectivity' | 'login_alert' | 'kyc_approval';
  };
  const startedAt = Date.now();
  const session = req.adminSession!;
  await appendCriticalAudit({ event: 'admin_test_email_authorized', adminId: session.adminId, email: session.email, ip: req.ip, reason: 'Administrator requested provider delivery test', meta: { type } });

  try {
    if (type === 'login_alert') {
      await sendAdminLoginAlertEmail(to, 'Admin', req.ip ?? '127.0.0.1', req.headers['user-agent'] ?? 'Test Agent', 'Test Device', false);
      await appendCriticalAudit({ event: 'admin_test_email_queued', adminId: session.adminId, email: session.email, ip: req.ip, meta: { type } });
      return res.status(202).json({ ok: true, message: `Branded login-alert test queued for ${to}`, durationMs: Date.now() - startedAt, attempts: 1 });
    }

    if (type === 'kyc_approval') {
      await sendApprovalEmail(to, 'Test User');
      await appendCriticalAudit({ event: 'admin_test_email_queued', adminId: session.adminId, email: session.email, ip: req.ip, meta: { type } });
      return res.status(202).json({ ok: true, message: `Branded approval-template test queued for ${to}`, durationMs: Date.now() - startedAt, attempts: 1 });
    }

    const html = renderBrandedEmail({
      title: 'Email Delivery Confirmed',
      bodyHtml: '<p>This message confirms that the City Gate Capital production email provider, branded template, logo, and banking website link are working together.</p>',
      testLabel: `Email Center connectivity test · ${new Date().toUTCString()}`,
    });
    const result = await sendEmail({ to, subject: '✅ City Gate Capital — Branded Email Test', html });
    if (!result.success) {
      return res.status(502).json({ ok: false, message: result.error ?? 'Delivery failed', durationMs: Date.now() - startedAt, attempts: result.attempts });
    }

    const deliveryStatus = result.messageId ? await waitForFinalEvent(result.messageId) : null;
    const failed = deliveryStatus ? FINAL_FAILURE.has(deliveryStatus) : false;
    const delivered = deliveryStatus ? FINAL_SUCCESS.has(deliveryStatus) : false;
    await appendCriticalAudit({ event: 'admin_test_email_completed', adminId: session.adminId, email: session.email, ip: req.ip, meta: { type, deliveryStatus: deliveryStatus ?? 'pending', success: !failed } });
    return res.status(failed ? 502 : delivered ? 200 : 202).json({
      ok: !failed,
      message: failed
        ? `Provider reported ${deliveryStatus} for ${to}`
        : delivered
          ? `Branded email delivered to ${to}`
          : `Branded email accepted for ${to}; final status is ${deliveryStatus ?? 'pending'}`,
      durationMs: Date.now() - startedAt,
      attempts: result.attempts,
      messageId: result.messageId,
      deliveryStatus,
      config: { transport: 'Resend HTTPS API', sender: 'info@citygate.capital', branding: 'admin/environment configured' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ ok: false, message, durationMs: Date.now() - startedAt, attempts: 0 });
  }
}
