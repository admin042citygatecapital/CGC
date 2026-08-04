/**
 * POST /api/admin/support/bulk
 * Body: { ids: string[], action: 'status' | 'assign' | 'priority' | 'export', value?: string }
 * Bulk status/assignment/priority update, or CSV export, across multiple
 * support conversations.
 */
import type { Request, Response } from 'express';
import {
  bulkUpdateStatus, bulkAssign, bulkUpdatePriority, bulkExportCsv,
  type SupportConversation,
} from '../../../../lib/supportStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isOneOf } from '../../../../lib/inputValidator.js';

const ACTIONS = ['status', 'assign', 'priority', 'export'] as const;
const STATUSES = ['open', 'pending', 'in_progress', 'resolved', 'closed'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export default async function handler(req: Request, res: Response) {
  const body = req.body as { ids?: unknown; action?: unknown; value?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((i): i is string => typeof i === 'string') : [];
  const action = isOneOf(body.action, ACTIONS);

  if (ids.length === 0 || !action) {
    return res.status(400).json({ ok: false, error: "ids (non-empty array) and a valid action ('status'|'assign'|'priority'|'export') are required" });
  }

  if (action === 'export') {
    const csv = bulkExportCsv(ids);
    return res.json({ ok: true, csv });
  }

  const value = typeof body.value === 'string' ? body.value : '';
  let result: { updated: number; ids: string[] };

  if (action === 'status') {
    const status = isOneOf(value, STATUSES);
    if (!status) return res.status(400).json({ ok: false, error: "value must be a valid status for action 'status'" });
    result = bulkUpdateStatus(ids, status as SupportConversation['status']);
  } else if (action === 'priority') {
    const priority = isOneOf(value, PRIORITIES);
    if (!priority) return res.status(400).json({ ok: false, error: "value must be a valid priority for action 'priority'" });
    result = bulkUpdatePriority(ids, priority as SupportConversation['priority']);
  } else {
    const assignee = sanitizeString(value, 100);
    if (!assignee) return res.status(400).json({ ok: false, error: "value (assignee) is required for action 'assign'" });
    result = bulkAssign(ids, assignee);
  }

  appendAudit({
    event: 'support_bulk_update',
    adminId: req.adminSession?.adminId,
    email: req.adminSession?.email,
    ip: req.ip ?? 'unknown',
    meta: { action, requested: ids.length, updated: result.updated },
  });

  return res.json({ ok: true, ...result });
}
