/**
 * GET /api/admin/security/logs
 * Admin security log viewer — returns paginated login-event or HTTP-access
 * log entries for the admin Security page (src/pages/admin/security.tsx).
 *
 * Admin-only: enforced by the `/api/admin` requireAdminAuth middleware in
 * entry.ts (this path is not in the public-suffix allow-list), matching the
 * sibling security endpoints (threats, sessions, …).
 *
 * Query params:
 *   type=login|http            which log to read (default: login)
 *   limit=50                   page size (1–200)
 *   offset=0                   row offset for pagination
 *
 *   // type=login filters:
 *   actor=admin|user           restrict to admin or user login events
 *   result=success|failed|...  restrict to a login result
 *   search=<text>              case-insensitive match on email / ip / ua / reason
 *
 *   // type=http filters:
 *   method=GET|POST|...        restrict to an HTTP method
 *   threat=<threatType>        restrict to a threat classification
 *   search=<text>              case-insensitive match on url / ip / ua
 *
 * Response: { ok: true, type, data, total, limit, offset }
 */
import type { Request, Response } from 'express';
import { getLoginHistory, type LoginActor, type LoginResult } from '../../../../lib/loginLog.js';
import { queryAccessLog, type ThreatType } from '../../../../lib/accessLog.js';

const VALID_ACTORS: ReadonlySet<string> = new Set(['admin', 'user']);
const VALID_LOGIN_RESULTS: ReadonlySet<string> = new Set([
  'success', 'failed', 'blocked', 'totp_failed', 'otp_sent', 'otp_failed', 'account_locked', 'status_denied',
]);

/** Upper bound on rows pulled from the login store before in-memory filtering. */
const LOGIN_SCAN_CAP = 5000;

function parseIntClamped(value: unknown, fallback: number, min: number, max: number): number {
  const n = parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export default async function handler(req: Request, res: Response) {
  try {
    const type   = String(req.query.type ?? 'login');
    const limit  = parseIntClamped(req.query.limit, 50, 1, 200);
    const offset = parseIntClamped(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    if (type === 'http') {
      const method = typeof req.query.method === 'string' && req.query.method !== 'all'
        ? req.query.method : undefined;
      const threat = typeof req.query.threat === 'string' && req.query.threat !== 'all'
        ? (req.query.threat as ThreatType) : undefined;

      // queryAccessLog handles method/threat/search filtering, pagination and
      // total natively against the Postgres access-log table.
      const { data, total } = await queryAccessLog({
        method,
        threat,
        search: search || undefined,
        limit,
        offset,
      });

      return res.json({ ok: true, type: 'http', data, total, limit, offset });
    }

    if (type === 'login') {
      const actorParam = typeof req.query.actor === 'string' ? req.query.actor : undefined;
      const actor: LoginActor | undefined =
        actorParam && VALID_ACTORS.has(actorParam) ? (actorParam as LoginActor) : undefined;

      const resultParam = typeof req.query.result === 'string' ? req.query.result : undefined;
      const resultFilter: LoginResult | undefined =
        resultParam && VALID_LOGIN_RESULTS.has(resultParam) ? (resultParam as LoginResult) : undefined;

      // getLoginHistory supports actor filtering + newest-first ordering at the
      // DB level. `result` and free-text `search`, plus offset pagination and a
      // filtered total, are not part of its signature, so they are applied here
      // in-memory over a capped, newest-first scan — mirroring the in-memory
      // search accessLog.queryAccessLog already performs.
      const events = await getLoginHistory({ actor, limit: LOGIN_SCAN_CAP });

      const filtered = events.filter((e) => {
        if (resultFilter && e.result !== resultFilter) return false;
        if (search) {
          const haystack = `${e.email} ${e.ip} ${e.ua} ${e.reason ?? ''}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      });

      const total = filtered.length;
      const data  = filtered.slice(offset, offset + limit);

      return res.json({ ok: true, type: 'login', data, total, limit, offset });
    }

    return res.status(400).json({ ok: false, error: `Unsupported log type: ${type}. Expected 'login' or 'http'.` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: 'api.admin.security.logs.failed', error: message }));
    return res.status(500).json({ ok: false, error: 'Failed to load security logs', message });
  }
}
