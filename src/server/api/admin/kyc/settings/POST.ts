/**
 * POST /api/admin/kyc/settings
 * Update KYC expiry / renewal settings.
 */
import type { Request, Response } from 'express';
import { readKycSettings, writeKycSettings } from '../../../../lib/kycStore.js';
import { appendAudit, appendCriticalAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { expiryMonths, renewalReminderDays, autoRestrictExpired } = req.body ?? {};

  const current = await readKycSettings();
  const nextExpiryMonths = expiryMonths === undefined ? current.expiryMonths : Number(expiryMonths);
  const nextRenewalReminderDays = renewalReminderDays === undefined ? current.renewalReminderDays : Number(renewalReminderDays);
  if (!Number.isInteger(nextExpiryMonths) || nextExpiryMonths < 1 || nextExpiryMonths > 120) {
    return res.status(400).json({ error: 'expiryMonths must be an integer between 1 and 120.' });
  }
  if (!Number.isInteger(nextRenewalReminderDays) || nextRenewalReminderDays < 1 || nextRenewalReminderDays > 365) {
    return res.status(400).json({ error: 'renewalReminderDays must be an integer between 1 and 365.' });
  }
  if (autoRestrictExpired !== undefined && typeof autoRestrictExpired !== 'boolean') {
    return res.status(400).json({ error: 'autoRestrictExpired must be a boolean.' });
  }
  const updated = {
    ...current,
    expiryMonths: nextExpiryMonths,
    renewalReminderDays: nextRenewalReminderDays,
    ...(autoRestrictExpired !== undefined && { autoRestrictExpired }),
    updatedAt: new Date().toISOString(),
    updatedBy: session.adminId,
  };

  await appendCriticalAudit({ event: 'admin_kyc_settings_update_intent', adminId: session.adminId,
    email: session.email, ip: req.ip ?? 'unknown', meta: { previous: current, requested: { expiryMonths, renewalReminderDays, autoRestrictExpired } } });
  await writeKycSettings(updated);
  appendAudit({ event: 'admin_kyc_settings_update', adminId: session.adminId, ip: req.ip ?? 'unknown' });

  return res.json({ ok: true, settings: updated });
}
