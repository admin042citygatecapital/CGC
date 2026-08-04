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
import { queryAccessLog } from '../../../../lib/accessLog.js';
import { loadThreats } from '../../../../lib/threatDetector.js';
import { readAudit } from '../../../../lib/auditLog.js';

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
  const to     = req.query.to   as string | undefined;

  let rows: Record<string, unknown>[] = [];
  let filename = `cgc-${type}-log-${new Date().toISOString().slice(0,10)}`;

  switch (type) {
    case 'http': {
      const result = await queryAccessLog({ from, to, limit });
      rows = result.data as unknown as Record<string, unknown>[];
      filename += '.csv';
      break;
    }
    case 'threats': {
      rows = (await loadThreats(limit)) as unknown as Record<string, unknown>[];
      filename += '.csv';
      break;
    }
    case 'audit': {
      const result = await readAudit(limit, 0);
      rows = result.data as unknown as Record<string, unknown>[];
      filename += '.csv';
      break;
    }
    default: { // login
      rows = (await getLoginHistory({ from, to, limit })) as unknown as Record<string, unknown>[];
      filename += '.csv';
    }
  }

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace('.csv', '.json')}"`);
    return res.json({ ok: true, data: rows });
  }

  const csv = toCSV(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
}
