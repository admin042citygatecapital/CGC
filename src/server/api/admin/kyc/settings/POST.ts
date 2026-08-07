/**
 * POST /api/admin/kyc/settings
 * Update KYC expiry / renewal settings.
 */
import type { Request, Response } from 'express';
import { readKycSettings, writeKycSettings } from '../../../../lib/kycStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { expiryMonths, renewalReminderDays, autoRestrictExpired } = req.body ?? {};

  const current = await readKycSettings();
  const updated = {
    ...current,
    ...(expiryMonths        !== undefined && { expiryMonths:        Number(expiryMonths) }),
    ...(renewalReminderDays !== undefined && { renewalReminderDays: Number(renewalReminderDays) }),
    ...(autoRestrictExpired !== undefined && { autoRestrictExpired: Boolean(autoRestrictExpired) }),
    updatedAt: new Date().toISOString(),
    updatedBy: session.adminId,
  };

  await writeKycSettings(updated);
  appendAudit({ event: 'admin_kyc_settings_update', adminId: session.adminId, ip: req.ip ?? 'unknown' });

  return res.json({ ok: true, settings: updated });
}
