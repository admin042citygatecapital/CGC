/**
 * POST /api/admin/security/alerts
 * Actions: resolve | create (manual alert)
 */
import type { Request, Response } from 'express';
import { resolveAlert, appendAlert, type AlertType, type AlertSeverity } from '../../../../lib/securityCenterStore.js';

const ALERT_TYPES = new Set<AlertType>([
  'brute_force', 'ip_blocked', 'session_hijack', 'unusual_admin_activity',
  'mass_login_failure', 'rate_limit_exceeded', 'new_admin_login',
  'config_change', 'permission_change', 'manual',
]);
const ALERT_SEVERITIES = new Set<AlertSeverity>(['critical', 'high', 'medium', 'low', 'info']);

function boundedText(value: unknown, maximum: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

export default async function handler(req: Request, res: Response) {
  try {
    const { action, id, type, severity, title, detail, ip } =
      req.body as { action: string; id?: string; type?: AlertType; severity?: AlertSeverity; title?: string; detail?: string; ip?: string };
    const adminEmail = req.adminSession?.email ?? 'admin';
    const adminId = req.adminSession?.adminId;

    if (action === 'resolve') {
      if (!id || !/^alrt_[a-f0-9]{12}$/.test(id)) return res.status(400).json({ error: 'Valid alert id required' });
      const ok = await resolveAlert(id, adminEmail);
      if (!ok) return res.status(404).json({ error: 'Alert not found' });
      return res.json({ ok: true });
    }

    if (action === 'create') {
      const cleanTitle = boundedText(title, 160);
      const cleanDetail = boundedText(detail, 2_000);
      const cleanIp = boundedText(ip, 64) || undefined;
      if (!type || !ALERT_TYPES.has(type) || !severity || !ALERT_SEVERITIES.has(severity) || !cleanTitle) {
        return res.status(400).json({ error: 'Valid type, severity, and title required' });
      }
      const alert = await appendAlert({
        type,
        severity,
        title: cleanTitle,
        detail: cleanDetail,
        ip: cleanIp,
        adminId,
        resolved: false,
      });
      return res.status(201).json({ ok: true, alert });
    }

    res.status(400).json({ error: 'Unsupported alert action' });
  } catch {
    res.status(500).json({ error: 'Alert operation failed' });
  }
}
