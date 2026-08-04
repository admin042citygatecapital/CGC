/**
 * POST /api/admin/support/notifications
 * Body: Partial<SupportNotificationSettings>
 * Update support notification settings.
 */
import type { Request, Response } from 'express';
import { readNotificationSettings, writeNotificationSettings } from '../../../../lib/supportStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;
  const current = readNotificationSettings();

  const next = {
    ...current,
    urgentTicketInPanel: typeof raw.urgentTicketInPanel === 'boolean' ? raw.urgentTicketInPanel : current.urgentTicketInPanel,
    urgentTicketEmail:   typeof raw.urgentTicketEmail   === 'boolean' ? raw.urgentTicketEmail   : current.urgentTicketEmail,
    noResponseInPanel:   typeof raw.noResponseInPanel   === 'boolean' ? raw.noResponseInPanel   : current.noResponseInPanel,
    noResponseEmail:     typeof raw.noResponseEmail     === 'boolean' ? raw.noResponseEmail     : current.noResponseEmail,
    noResponseHours:     typeof raw.noResponseHours     === 'number'  ? raw.noResponseHours     : current.noResponseHours,
    reopenedInPanel:     typeof raw.reopenedInPanel      === 'boolean' ? raw.reopenedInPanel      : current.reopenedInPanel,
    reopenedEmail:       typeof raw.reopenedEmail        === 'boolean' ? raw.reopenedEmail        : current.reopenedEmail,
    notifyEmail:         typeof raw.notifyEmail          === 'string'  ? sanitizeString(raw.notifyEmail, 254) : current.notifyEmail,
    updatedAt:           new Date().toISOString(),
  };

  writeNotificationSettings(next);

  appendAudit({
    event: 'support_notification_settings_updated',
    adminId: req.adminSession?.adminId,
    email: req.adminSession?.email,
    ip: req.ip ?? 'unknown',
  });

  return res.json({ ok: true, settings: next });
}
