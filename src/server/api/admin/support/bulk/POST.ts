/**
 * POST /api/admin/support/bulk
 * Bulk operations on multiple tickets.
 * Body: { ids: string[], action: 'resolve'|'close'|'assign'|'priority'|'export', value?: string }
 *
 * Security hardening:
 *  - ids array elements validated with safeParseId() — rejects __proto__ etc.
 *  - action validated against explicit allowlist
 *  - value sanitized before use
 */
import type { Request, Response } from 'express';
import {
  bulkUpdateStatus, bulkAssign, bulkUpdatePriority, bulkExportCsv,
} from '../../../../lib/supportStore.js';
import type { SupportConversation } from '../../../../lib/supportStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { safeParseId, sanitizeString, isOneOf } from '../../../../lib/inputValidator.js';

const VALID_ACTIONS    = ['resolve','close','pending','assign','priority','export'] as const;
const VALID_PRIORITIES = ['low','medium','high','urgent'] as const;

export default function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { ids, action, value } = req.body ?? {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ ok: false, error: 'ids array required' });
  }

  // Validate each ID — reject the whole request if any element is malformed
  const safeIds: string[] = [];
  for (const id of ids) {
    const safe = safeParseId(id);
    if (!safe) return res.status(400).json({ ok: false, error: `Invalid id value: ${String(id).slice(0, 40)}` });
    safeIds.push(safe);
  }

  // Validate action against allowlist
  const safeAction = isOneOf(action, VALID_ACTIONS);
  if (!safeAction) {
    return res.status(400).json({ ok: false, error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
  }

  const safeValue = value !== undefined ? sanitizeString(value, 200) : undefined;

  appendAudit({
    event:   'admin_support_bulk',
    adminId: session.adminId,
    ip:      req.ip ?? 'unknown',
    meta:    { action: safeAction, count: safeIds.length, value: safeValue },
  });

  switch (safeAction) {
    case 'resolve': {
      const result = bulkUpdateStatus(safeIds, 'resolved');
      return res.json({ ok: true, ...result });
    }
    case 'close': {
      const result = bulkUpdateStatus(safeIds, 'closed');
      return res.json({ ok: true, ...result });
    }
    case 'pending': {
      const result = bulkUpdateStatus(safeIds, 'pending');
      return res.json({ ok: true, ...result });
    }
    case 'assign': {
      if (!safeValue) return res.status(400).json({ ok: false, error: 'value (agent name) required for assign' });
      const result = bulkAssign(safeIds, safeValue);
      return res.json({ ok: true, ...result });
    }
    case 'priority': {
      const safePriority = isOneOf(safeValue, VALID_PRIORITIES);
      if (!safePriority) return res.status(400).json({ ok: false, error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
      const result = bulkUpdatePriority(safeIds, safePriority as SupportConversation['priority']);
      return res.json({ ok: true, ...result });
    }
    case 'export': {
      const csv = bulkExportCsv(safeIds);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="tickets-export.csv"');
      return res.send(csv);
    }
    default:
      return res.status(400).json({ ok: false, error: `Unknown action: ${safeAction}` });
  }
}
