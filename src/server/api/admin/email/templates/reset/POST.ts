/**
 * POST /api/admin/email/templates/reset
 * Body: { id: TemplateId } — reverts a template to its default content.
 */
import type { Request, Response } from 'express';
import { resetTemplate, getTemplate, type TemplateId } from '../../../../../lib/emailTemplateStore.js';
import { appendAudit } from '../../../../../lib/auditLog.js';
import { isOneOf } from '../../../../../lib/inputValidator.js';

const TEMPLATE_IDS = [
  'welcome', 'kyc_approved', 'kyc_rejected', 'deposit_confirmed', 'withdrawal_approved',
  'transfer_sent', 'transfer_received', 'password_reset', 'two_fa_code', 'security_alert',
] as const satisfies readonly TemplateId[];

export default async function handler(req: Request, res: Response) {
  const { id } = req.body as { id?: string };
  const templateId = isOneOf(id, TEMPLATE_IDS);
  if (!templateId) return res.status(400).json({ ok: false, error: 'A valid template id is required' });
  if (!getTemplate(templateId)) return res.status(404).json({ ok: false, error: 'Template not found' });

  const reset = resetTemplate(templateId);

  appendAudit({ event: 'admin_email_template_reset', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { id: templateId } });

  return res.json({ ok: true, template: reset });
}
