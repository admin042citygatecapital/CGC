/**
 * GET /api/admin/trading/logs
 * Admin trading activity log — the audit-log entries produced by the trading
 * admin routes (markets, fees, providers, freeze), shaped for the Logs tab of
 * src/pages/admin/trading.tsx.
 *
 * Admin-only: enforced by the `/api/admin` requireAdminAuth middleware in
 * entry.ts (this path is not in the public-suffix allow-list), matching the
 * sibling trading endpoints (markets, fees, providers, …).
 *
 * The trading routes all record their actions via appendAudit() with an
 * `event` of the form `trading_*` (e.g. trading_market_updated,
 * trading_fee_tier_created, trading_provider_updated, trading_freeze). The
 * shared audit store has no notion of a "category", so it is derived here
 * from the action name to drive the client-side category filter/badges.
 *
 * Query params:
 *   category=market|fee|provider|freeze|account|config  filter (default: all)
 *   limit=100                                            page size (1–200)
 *
 * Response: { ok: true, logs }
 */
import type { Request, Response } from 'express';
import { getAuditLog, type AuditEntry } from '../../../../lib/auditLog.js';

/** Rows pulled from the audit store before filtering down to trading events. */
const AUDIT_SCAN_CAP = 1000;

function parseIntClamped(value: unknown, fallback: number, min: number, max: number): number {
  const n = parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Map a `trading_*` audit action onto one of the categories the Logs tab
 * renders. Order matters: `trading_market_*` must be tested before the
 * bare freeze check so `trading_market_suspended` lands under "market".
 */
function categoryFor(action: string): string {
  if (action.startsWith('trading_market_'))   return 'market';
  if (action.startsWith('trading_fee_'))      return 'fee';
  if (action.startsWith('trading_provider_')) return 'provider';
  if (action.startsWith('trading_account_'))  return 'account';
  if (action === 'trading_freeze' || action === 'trading_unfreeze') return 'freeze';
  return 'config';
}

/** Flatten the audit `details` record into the single line the UI renders. */
function formatDetails(details: Record<string, unknown> | undefined): string {
  if (!details) return '';
  return Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

/** Human-readable label for the entity the action targeted, when identifiable. */
function targetLabelFor(entry: AuditEntry): string | undefined {
  const d = entry.details;
  if (!d) return entry.target;
  const symbol = d.symbol ?? d.name ?? d.id;
  return symbol !== undefined ? String(symbol) : entry.target;
}

export default async function handler(req: Request, res: Response) {
  try {
    const limit = parseIntClamped(req.query.limit, 100, 1, 200);
    const category = typeof req.query.category === 'string' && req.query.category !== 'all'
      ? req.query.category
      : undefined;

    // getAuditLog filters by exact action only, so scan recent entries and
    // narrow to the trading_* family here.
    const entries = await getAuditLog({ limit: AUDIT_SCAN_CAP });

    const logs = entries
      .filter(e => e.action.startsWith('trading_'))
      .map(e => ({
        id:          e.id,
        action:      e.action,
        category:    categoryFor(e.action),
        targetId:    e.targetId,
        targetLabel: targetLabelFor(e),
        details:     formatDetails(e.details),
        adminId:     e.adminId,
        adminEmail:  e.adminEmail,
        ip:          e.ip,
        createdAt:   e.ts,
      }))
      .filter(l => !category || l.category === category)
      .slice(0, limit);

    res.json({ ok: true, logs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: 'api.admin.trading.logs.failed', error: message }));
    res.status(500).json({ ok: false, error: 'Failed to load trading logs', message });
  }
}
