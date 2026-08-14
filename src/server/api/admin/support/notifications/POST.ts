/**
 * POST /api/admin/support/notifications
 * Save support notification settings.
 */
import type { Request, Response } from 'express';
import { readNotificationSettings, writeNotificationSettings } from '../../../../lib/supportDatabaseStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const body = req.body ?? {};

  const current = await readNotificationSettings();
  const booleanValue = (key: keyof typeof current) => typeof body[key] === 'boolean' ? body[key] : current[key];
  const hours = Number(body.noResponseHours ?? current.noResponseHours);
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) return res.status(400).json({ ok: false, error: 'No-response hours must be between 1 and 168' });
  const notifyEmail = String(body.notifyEmail ?? current.notifyEmail).trim().toLowerCase();
  if (notifyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) return res.status(400).json({ ok: false, error: 'A valid notification email is required' });
  const updated = {
    urgentTicketInPanel: booleanValue('urgentTicketInPanel') as boolean,
    urgentTicketEmail: booleanValue('urgentTicketEmail') as boolean,
    noResponseInPanel: booleanValue('noResponseInPanel') as boolean,
    noResponseEmail: booleanValue('noResponseEmail') as boolean,
    noResponseHours: hours,
    reopenedInPanel: booleanValue('reopenedInPanel') as boolean,
    reopenedEmail: booleanValue('reopenedEmail') as boolean,
    notifyEmail: notifyEmail.slice(0, 254),
    updatedAt: new Date().toISOString(),
  };

  await writeNotificationSettings(updated, session.adminId);

  appendAudit({
    event:   'admin_support_notifications_updated',
    adminId: session.adminId,
    ip:      req.ip ?? 'unknown',
  });

  return res.json({ ok: true, settings: updated });
}
