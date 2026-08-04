/**
 * POST /api/admin/kyc/settings
 * Body: { expiryMonths?, renewalReminderDays?, autoRestrictExpired? }
 */
import type { Request, Response } from 'express';
import { readKycSettings, writeKycSettings } from '../../../../lib/kycStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { expiryMonths?: number; renewalReminderDays?: number; autoRestrictExpired?: boolean };
  const current = await readKycSettings();

  const next = {
    ...current,
    expiryMonths: typeof raw.expiryMonths === 'number' && raw.expiryMonths > 0 ? raw.expiryMonths : current.expiryMonths,
    renewalReminderDays: typeof raw.renewalReminderDays === 'number' && raw.renewalReminderDays >= 0 ? raw.renewalReminderDays : current.renewalReminderDays,
    autoRestrictExpired: typeof raw.autoRestrictExpired === 'boolean' ? raw.autoRestrictExpired : current.autoRestrictExpired,
    updatedAt: new Date().toISOString(),
    updatedBy: req.adminSession?.email,
  };
  await writeKycSettings(next);

  appendAudit({ event: 'admin_kyc_settings_updated', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown' });

  return res.json({ ok: true, settings: next });
}
