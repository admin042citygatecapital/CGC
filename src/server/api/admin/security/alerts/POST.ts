/**
 * POST /api/admin/security/alerts
 * Body: { action: 'resolve', id } to resolve an alert, otherwise
 * { type, severity, title, detail, ip?, userId?, adminId?, meta? } to log
 * a manual alert.
 */
import type { Request, Response } from 'express';
import { resolveAlert, appendAlert, type AlertType, type AlertSeverity } from '../../../../lib/securityCenterStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { sanitizeString, isOneOf } from '../../../../lib/inputValidator.js';

const TYPES = [
  'brute_force', 'ip_blocked', 'session_hijack', 'unusual_admin_activity',
  'mass_login_failure', 'rate_limit_exceeded', 'new_admin_login',
  'config_change', 'permission_change', 'manual',
] as const satisfies readonly AlertType[];
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const satisfies readonly AlertSeverity[];

export default async function handler(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;
  const adminEmail = req.adminSession?.email ?? '';
  const ip = req.ip ?? 'unknown';

  if (raw.action === 'resolve') {
    const id = typeof raw.id === 'string' ? raw.id : '';
    if (!id) return res.status(400).json({ ok: false, error: 'id is required to resolve an alert' });
    const ok = resolveAlert(id, adminEmail);
    if (!ok) return res.status(404).json({ ok: false, error: 'Alert not found' });

    appendAudit({ event: 'security_alert_resolved', email: adminEmail, ip, meta: { id } });
    return res.json({ ok: true });
  }

  const type = isOneOf(raw.type, TYPES) ?? 'manual';
  const severity = isOneOf(raw.severity, SEVERITIES);
  const title = sanitizeString(raw.title, 200);
  const detail = sanitizeString(raw.detail, 2000);
  if (!severity || !title || !detail) {
    return res.status(400).json({ ok: false, error: 'severity, title, and detail are required' });
  }

  const alert = appendAlert({
    type, severity, title, detail,
    ip: typeof raw.ip === 'string' ? raw.ip : ip,
    userId: typeof raw.userId === 'string' ? raw.userId : undefined,
    adminId: req.adminSession?.adminId,
    resolved: false,
  });

  appendAudit({ event: 'security_alert_created', email: adminEmail, ip, meta: { id: alert.id, type } });
  return res.status(201).json({ ok: true, alert });
}
