/**
 * POST /api/admin/email/templates
 * Body: { id: TemplateId, subject?: string, body?: string }
 */
import type { Request, Response } from 'express';
import { saveTemplate, getTemplate, type TemplateId } from '../../../../lib/emailTemplateStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { isOneOf } from '../../../../lib/inputValidator.js';

const TEMPLATE_IDS = [
  'welcome', 'kyc_approved', 'kyc_rejected', 'deposit_confirmed', 'withdrawal_approved',
  'transfer_sent', 'transfer_received', 'password_reset', 'two_fa_code', 'security_alert',
] as const satisfies readonly TemplateId[];

export default async function handler(req: Request, res: Response) {
  const { id, subject, body } = req.body as { id?: string; subject?: string; body?: string };
  const templateId = isOneOf(id, TEMPLATE_IDS);
  if (!templateId) return res.status(400).json({ ok: false, error: 'A valid template id is required' });
  if (!getTemplate(templateId)) return res.status(404).json({ ok: false, error: 'Template not found' });

  const adminEmail = req.adminSession?.email ?? 'admin';
  const updated = saveTemplate(templateId, { subject, body }, adminEmail);

  appendAudit({ event: 'admin_email_template_updated', adminId: req.adminSession?.adminId, email: adminEmail, ip: req.ip ?? 'unknown', meta: { id: templateId } });

  return res.json({ ok: true, template: updated });
}
