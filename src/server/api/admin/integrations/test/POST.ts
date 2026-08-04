/**
 * POST /api/admin/integrations/test
 * Body: { id: IntegrationId }
 * There's no real outbound connectivity check to any of these third-party
 * APIs anywhere in this codebase, so "success" here means "every secret
 * this integration marks as required is actually configured" — the same
 * signal getIntegration() already surfaces per-secret via hasSecret(),
 * not a fabricated "yes it's connected".
 */
import type { Request, Response } from 'express';
import { getIntegration, recordTestResult, type IntegrationId } from '../../../../lib/integrationStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

const IDS: IntegrationId[] = [
  'zoho_mail', 'smartsupp', 'cloudflare', 'google_analytics',
  'google_tag_manager', 'google_maps', 'stripe', 'paypal',
  'twilio', 'whatsapp_business', 'banking_api',
];

export default async function handler(req: Request, res: Response) {
  const { id } = req.body as { id?: string };
  if (!id || !IDS.includes(id as IntegrationId)) {
    return res.status(400).json({ ok: false, error: `id must be one of: ${IDS.join(', ')}` });
  }

  const before = getIntegration(id as IntegrationId);
  if (!before) return res.status(404).json({ ok: false, error: 'Integration not found' });

  const missingRequired = before.secrets.filter(s => s.required && !s.present);
  const success = missingRequired.length === 0;

  recordTestResult(id as IntegrationId, success);
  appendAudit({ event: 'admin_integration_tested', adminId: req.adminSession?.adminId, email: req.adminSession?.email, ip: req.ip ?? 'unknown', meta: { id, success } });

  const integration = getIntegration(id as IntegrationId);
  return res.json({
    ok: true,
    success,
    missingSecrets: missingRequired.map(s => s.name),
    integration,
  });
}
