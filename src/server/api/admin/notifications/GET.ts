import type { Request, Response } from 'express';
import { getQueryClient, isDatabaseConfigured } from '../../../db/db.js';

export default async function handler(_req: Request, res: Response) {
  if (!isDatabaseConfigured()) return res.json({ ok: true, dispatches: [] });
  const rows = await getQueryClient()<Array<Record<string, unknown>>>`
    SELECT id, category, target_type AS "targetType", target_spec AS "targetSpec",
           title, reason, status, created_by AS "createdBy",
           recipient_count AS "recipientCount", delivered_count AS "deliveredCount",
           failed_count AS "failedCount", created_at AS "createdAt", completed_at AS "completedAt"
      FROM admin_notification_dispatches
     ORDER BY created_at DESC
     LIMIT 100
  `;
  return res.json({ ok: true, dispatches: rows });
}

