/**
 * POST /api/admin/security/alerts
 * Actions: resolve | create (manual alert)
 */
import type { Request, Response } from 'express';
import { resolveAlert, appendAlert, type AlertType, type AlertSeverity } from '../../../../lib/securityCenterStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { action, id, type, severity, title, detail, ip } =
      req.body as { action: string; id?: string; type?: AlertType; severity?: AlertSeverity; title?: string; detail?: string; ip?: string };
    const adminEmail = (req as unknown as { admin?: { email: string } }).admin?.email ?? 'admin';

    if (action === 'resolve') {
      if (!id) return res.status(400).json({ error: 'id required' });
      const ok = resolveAlert(id, adminEmail);
      if (!ok) return res.status(404).json({ error: 'Alert not found' });
      return res.json({ ok: true });
    }

    if (action === 'create') {
      if (!type || !severity || !title) return res.status(400).json({ error: 'type, severity, title required' });
      const alert = appendAlert({ type, severity, title, detail: detail ?? '', ip, resolved: false });
      return res.status(201).json({ ok: true, alert });
    }

    res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    res.status(500).json({ error: 'Alert operation failed', message: String(err) });
  }
}
