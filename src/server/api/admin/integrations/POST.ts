/**
 * POST /api/admin/integrations
 * Body: { id: IntegrationId, enabled?, notes?, config? }
 * Updates admin-supplied config overrides only — real credentials always
 * come from getSecret()/Settings → Secrets, never through this endpoint.
 */
import type { Request, Response } from 'express';
import { updateIntegration, type IntegrationId } from '../../../lib/integrationStore.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { sanitizeString } from '../../../lib/inputValidator.js';

const IDS: IntegrationId[] = [
  'zoho_mail', 'smartsupp', 'cloudflare', 'google_analytics',
  'google_tag_manager', 'google_maps', 'stripe', 'paypal',
  'twilio', 'whatsapp_business', 'banking_api',
];

export default async function handler(req: Request, res: Response) {
  const raw = req.body as { id?: string; enabled?: boolean; notes?: string; config?: Record<string, unknown> };
  if (!raw.id || !IDS.includes(raw.id as IntegrationId)) {
    return res.status(400).json({ ok: false, error: `id must be one of: ${IDS.join(', ')}` });
  }

  const config: Record<string, string> | undefined = raw.config
    ? Object.fromEntries(Object.entries(raw.config).map(([k, v]) => [sanitizeString(k, 100), sanitizeString(v, 500)]))
    : undefined;

  const integration = updateIntegration(raw.id as IntegrationId, {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : undefined,
    notes: typeof raw.notes === 'string' ? sanitizeString(raw.notes, 1000) : undefined,
    config,
  });

  appendAudit({ event: 'admin_integration_updated', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { id: raw.id } });

  return res.json({ ok: true, integration });
}
