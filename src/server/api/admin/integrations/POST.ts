/**
 * POST /api/admin/integrations
 * Update an integration's enabled state, notes, or non-secret config fields.
 *
 * Body: { id: IntegrationId; enabled?: boolean; notes?: string; config?: Record<string,string> }
 */
import type { Request, Response } from 'express';
import {
  MANAGED_INTEGRATION_IDS,
  updateIntegration,
  type IntegrationId,
} from '../../../lib/integrationStore.js';
import { appendCriticalAudit } from '../../../lib/auditLog.js';

const VALID_IDS = new Set<IntegrationId>(MANAGED_INTEGRATION_IDS);

export default async function handler(req: Request, res: Response) {
  try {
    const { id, enabled, notes, config } =
      req.body as { id: IntegrationId; enabled?: boolean; notes?: string; config?: Record<string, string> };

    if (!id || !VALID_IDS.has(id)) {
      return res.status(400).json({ error: `Invalid integration id: ${id}` });
    }

    const adminId = req.adminSession?.adminId ?? 'admin';
    await appendCriticalAudit({
      event: 'admin_integration_settings_updated',
      adminId,
      ip: req.ip,
      meta: { id, fields: Object.keys({ enabled, notes, config }).filter(key => req.body[key] !== undefined) },
    });
    const updated = await updateIntegration(id, { enabled, notes, config }, adminId);
    res.json({ ok: true, integration: updated });
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_INTEGRATION_SETTINGS') {
      return res.status(400).json({ error: 'Only documented non-secret integration settings are accepted.' });
    }
    res.status(500).json({ error: 'Failed to update integration', message: String(err) });
  }
}
