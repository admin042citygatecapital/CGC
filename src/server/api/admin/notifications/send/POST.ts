/**
 * POST /api/admin/notifications/send
 * Admin sends a notification to a specific customer.
 * Body: { userId, title, message, link? }
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../lib/userStore.js';
import { createNotification } from '../../../../lib/notificationStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, title, message, link } = req.body ?? {};

  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });
  const safeTitle = sanitizeString(title, 200);
  const safeMessage = sanitizeString(message, 2000);
  if (!safeTitle) return res.status(400).json({ ok: false, error: 'title is required' });
  if (!safeMessage) return res.status(400).json({ ok: false, error: 'message is required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  const notif = await createNotification(
    userId,
    safeTitle,
    safeMessage,
    link ? sanitizeString(link, 500) : undefined,
  );

  appendAudit({
    event: 'admin_notification_sent',
    adminId: session.adminId,
    userId,
    email: user.email,
    ip: req.ip ?? 'unknown',
    meta: { notifId: notif.id, title: notif.title },
  });

  return res.status(201).json({ ok: true, notification: notif });
}
