/**
 * GET /api/admin/security/alerts
 * System-level security alerts (brute force, IP blocks, session hijack,
 * rate-limit trips, config/permission changes) — distinct from the
 * per-customer threat flags covered by admin/security/threats.
 * Query: severity, resolved ('true'|'false'), limit
 */
import type { Request, Response } from 'express';
import { loadAlerts, alertStats } from '../../../../lib/securityCenterStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const q = req.query as Record<string, string | undefined>;
    const limit = Math.min(1000, Math.max(1, parseInt(q.limit ?? '200', 10) || 200));

    let alerts = loadAlerts(limit);
    if (q.severity) alerts = alerts.filter(a => a.severity === q.severity);
    if (q.resolved === 'true') alerts = alerts.filter(a => a.resolved);
    if (q.resolved === 'false') alerts = alerts.filter(a => !a.resolved);

    return res.json({ ok: true, alerts, stats: alertStats() });
  } catch (err) {
    console.error('[admin/security/alerts GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load security alerts' });
  }
}
