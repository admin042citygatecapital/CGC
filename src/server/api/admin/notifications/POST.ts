import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { getQueryClient, isDatabaseConfigured } from '../../../db/db.js';
import { appendCriticalAudit } from '../../../lib/auditLog.js';
import { requireIdempotency } from '../../../lib/idempotency.js';
import { createNotification } from '../../../lib/notificationStore.js';
import { loadAllUsers } from '../../../lib/userStore.js';

const CATEGORIES = new Set(['customer', 'security', 'maintenance', 'service', 'support']);
const TARGETS = new Set(['customer', 'group', 'all']);

interface ExistingDispatch {
  id: string;
  requestFingerprint: string;
  status: string;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
}

function replayHttpStatus(status: string): number {
  if (status === 'pending') return 202;
  if (status === 'failed') return 502;
  return 200;
}

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const category = String(req.body?.category ?? '').trim().toLowerCase();
  const targetType = String(req.body?.targetType ?? '').trim().toLowerCase();
  const userId = String(req.body?.userId ?? '').trim();
  const title = String(req.body?.title ?? '').trim();
  const message = String(req.body?.message ?? '').trim();
  const link = String(req.body?.link ?? '').trim();
  const reason = String(req.body?.reason ?? '').trim();
  const confirmation = String(req.body?.confirmation ?? '').trim();
  const group = req.body?.group && typeof req.body.group === 'object' ? req.body.group as Record<string, string> : {};

  if (!CATEGORIES.has(category) || !TARGETS.has(targetType)) return res.status(400).json({ ok: false, error: 'Invalid category or target.' });
  if (!title || title.length > 140 || !message || message.length > 2000) return res.status(400).json({ ok: false, error: 'A valid title and message are required.' });
  if (reason.length < 8 || reason.length > 500) return res.status(400).json({ ok: false, error: 'A clear operational reason is required.' });
  if (targetType === 'customer' && !userId) return res.status(400).json({ ok: false, error: 'A customer is required.' });
  if (targetType !== 'customer' && confirmation !== 'CONFIRM BULK SEND') return res.status(409).json({ ok: false, error: 'Type CONFIRM BULK SEND to authorize this bulk communication.' });

  const normalizedRequest = { category, targetType, userId, title, message, link, reason, group };
  const idempotency = requireIdempotency(req, res, 'admin-notification', normalizedRequest);
  if (!idempotency) return;

  const readExisting = async (): Promise<ExistingDispatch | undefined> => {
    if (!isDatabaseConfigured()) return undefined;
    const rows = await getQueryClient()<ExistingDispatch[]>`
      SELECT id, request_fingerprint AS "requestFingerprint", status,
             recipient_count AS "recipientCount", delivered_count AS "deliveredCount",
             failed_count AS "failedCount"
        FROM admin_notification_dispatches
       WHERE idempotency_key = ${idempotency.key}
       LIMIT 1
    `;
    return rows[0];
  };
  const existing = await readExisting();
  if (existing) {
    if (existing.requestFingerprint !== idempotency.fingerprint) {
      return res.status(409).json({ ok: false, error: 'This idempotency key was already used for a different notification dispatch.' });
    }
    return res.status(replayHttpStatus(existing.status)).json({
      ok: existing.status !== 'failed', replayed: true, dispatchId: existing.id, status: existing.status,
      recipientCount: existing.recipientCount, delivered: existing.deliveredCount, failed: existing.failedCount,
    });
  }

  const users = (await loadAllUsers()).filter(user => {
    if (targetType === 'customer') return user.id === userId;
    if (targetType === 'all') return true;
    return (!group.status || user.status === group.status)
      && (!group.country || user.country === group.country)
      && (!group.accountTier || user.accountTier === group.accountTier);
  });
  if (users.length === 0) return res.status(404).json({ ok: false, error: 'No eligible recipients matched this target.' });
  if (users.length > 5000) return res.status(413).json({ ok: false, error: 'Recipient set exceeds the controlled batch limit.' });

  const dispatchId = `nd_${crypto.randomBytes(12).toString('hex')}`;
  const requestId = String(req.get('X-Request-ID') ?? crypto.randomUUID());
  await appendCriticalAudit({
    event: 'admin_notification_dispatch_authorized', adminId: session.adminId, email: session.email,
    ip: req.ip, reason, meta: { dispatchId, requestId, category, targetType, recipientCount: users.length },
  });

  if (isDatabaseConfigured()) {
    try {
      await getQueryClient()`INSERT INTO admin_notification_dispatches
        (id, idempotency_key, request_fingerprint, category, target_type, target_spec, title, message, link, reason, status, created_by, recipient_count)
        VALUES (${dispatchId}, ${idempotency.key}, ${idempotency.fingerprint}, ${category}, ${targetType}, ${JSON.stringify({ userId: userId || undefined, group })}::jsonb,
                ${title}, ${message}, ${link || null}, ${reason}, 'pending', ${session.adminId}, ${users.length})`;
    } catch (error) {
      const raced = await readExisting();
      if (!raced) throw error;
      if (raced.requestFingerprint !== idempotency.fingerprint) {
        return res.status(409).json({ ok: false, error: 'This idempotency key was already used for a different notification dispatch.' });
      }
      return res.status(replayHttpStatus(raced.status)).json({
        ok: raced.status !== 'failed', replayed: true, dispatchId: raced.id, status: raced.status,
        recipientCount: raced.recipientCount, delivered: raced.deliveredCount, failed: raced.failedCount,
      });
    }
  }

  let delivered = 0;
  let failed = 0;
  for (const user of users) {
    try {
      const notification = await createNotification(user.id, title, message, link || undefined);
      delivered += 1;
      if (isDatabaseConfigured()) await getQueryClient()`INSERT INTO admin_notification_deliveries
        (id, dispatch_id, user_id, notification_id, status) VALUES
        (${`ndl_${crypto.randomBytes(10).toString('hex')}`}, ${dispatchId}, ${user.id}, ${notification.id}, 'delivered')`;
    } catch {
      failed += 1;
      if (isDatabaseConfigured()) await getQueryClient()`INSERT INTO admin_notification_deliveries
        (id, dispatch_id, user_id, status, error_code) VALUES
        (${`ndl_${crypto.randomBytes(10).toString('hex')}`}, ${dispatchId}, ${user.id}, 'failed', 'DELIVERY_FAILED')`;
    }
  }

  const status = failed === 0 ? 'completed' : delivered === 0 ? 'failed' : 'partial';
  if (isDatabaseConfigured()) await getQueryClient()`UPDATE admin_notification_dispatches SET
    status=${status}, delivered_count=${delivered}, failed_count=${failed}, completed_at=now() WHERE id=${dispatchId}`;
  await appendCriticalAudit({
    event: 'admin_notification_dispatch_completed', adminId: session.adminId, email: session.email,
    ip: req.ip, reason, meta: { dispatchId, requestId, status, delivered, failed },
  });
  return res.status(failed === users.length ? 502 : 201).json({ ok: failed !== users.length, dispatchId, status, recipientCount: users.length, delivered, failed });
}
