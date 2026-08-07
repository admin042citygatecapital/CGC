/**
 * GET /api/admin/security/export
 * Export logs as CSV or JSON.
 *
 * Query params:
 *   type=login|http|threats|audit
 *   format=csv|json (default: csv)
 *   from=ISO date
 *   to=ISO date
 *   limit=5000
 */
import type { Request, Response } from 'express';
import { getLoginHistory } from '../../../../lib/loginLog.js';
import { loadThreats } from '../../../../lib/threatDetector.js';
import { getAuditLog } from '../../../../lib/auditLog.js';

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape  = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n');
}

export default async function handler(req: Request, res: Response) {
  const type   = (req.query.type   as string) ?? 'login';
  const format = (req.query.format as string) ?? 'csv';
  const limit  = Math.min(10000, Number(req.query.limit ?? 5000));
  const from   = req.query.from as string | undefined;

  let rows: Record<string, unknown>[] = [];
  const filename = `cgc-${type}-log-${new Date().toISOString().slice(0,10)}.${format === 'json' ? 'json' : 'csv'}`;

  switch (type) {
    case 'threats': {
      rows = loadThreats(limit) as unknown as Record<string, unknown>[];
      break;
    }
    case 'audit': {
      const entries = await getAuditLog({ limit, from });
      rows = entries as unknown as Record<string, unknown>[];
      break;
    }
    default: { // login
      const entries = await getLoginHistory({ limit, from });
      rows = entries as unknown as Record<string, unknown>[];
    }
  }

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.json(rows);
  }

  const csv = toCSV(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
}
