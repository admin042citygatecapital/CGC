/**
 * GET /api/admin/trading/logs
 * Admin trading action log — the audit trail of trading-administration
 * actions (market create/update/suspend/resume, fee-tier changes, provider
 * changes, trading freeze/unfreeze, etc.) shown on the admin Trading page's
 * "Admin Action Log" tab (src/pages/admin/trading.tsx → LogsTab).
 *
 * Admin-only: enforced by the `/api/admin` requireAdminAuth middleware in
 * entry.ts (this path is not in the public-suffix allow-list), matching the
 * sibling trading endpoints.
 *
 * These entries are written by the trading write-handlers via
 * tradingAdminStore.appendTradingLog(...) (markets, fees, providers, freeze,
 * suspend). This endpoint reads them back, newest first.
 *
 * Query params:
 *   limit=200   maximum number of entries to return (1–500)
 *
 * Response: { ok: true, logs: TradingLog[] }  (the client reads `.logs`)
 */
import type { Request, Response } from 'express';
import { getTradingLogs } from '../../../../lib/tradingAdminStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const rawLimit = parseInt(String(req.query.limit ?? '200'), 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(500, Math.max(1, rawLimit)) : 200;

    const logs = getTradingLogs(limit);

    return res.json({ ok: true, logs, total: logs.length });
  } catch (err) {
    console.error(JSON.stringify({ event: 'api.admin.trading.logs.failed', error: err instanceof Error ? err.message : String(err) }));
    return res.status(500).json({ ok: false, error: 'Failed to load trading logs' });
  }
}
