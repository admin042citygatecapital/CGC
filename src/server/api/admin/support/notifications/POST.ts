/**
 * POST /api/admin/support/notifications
 * Save support notification settings.
 */
import type { Request, Response } from 'express';
import { readNotificationSettings, writeNotificationSettings } from '../../../../lib/supportStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const body = req.body ?? {};

  const current = readNotificationSettings();
  const updated = {
    ...current,
    ...body,
    updatedAt: new Date().toISOString(),
  };

  writeNotificationSettings(updated);

  appendAudit({
    event:   'admin_support_notifications_updated',
    adminId: session.adminId,
    ip:      req.ip ?? 'unknown',
  });

  return res.json({ ok: true, settings: updated });
}
