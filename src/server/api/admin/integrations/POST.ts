/**
 * POST /api/admin/integrations
 * Update an integration's enabled state, notes, or non-secret config fields.
 *
 * Body: { id: IntegrationId; enabled?: boolean; notes?: string; config?: Record<string,string> }
 */
import type { Request, Response } from 'express';
import { updateIntegration, type IntegrationId } from '../../../lib/integrationStore.js';

const VALID_IDS = new Set<IntegrationId>([
  'resend', 'zoho_mail', 'smartsupp', 'cloudflare', 'google_analytics',
  'google_tag_manager', 'google_maps', 'stripe', 'paypal',
  'twilio', 'whatsapp_business', 'banking_api',
]);

export default async function handler(req: Request, res: Response) {
  try {
    const { id, enabled, notes, config } =
      req.body as { id: IntegrationId; enabled?: boolean; notes?: string; config?: Record<string, string> };

    if (!id || !VALID_IDS.has(id)) {
      return res.status(400).json({ error: `Invalid integration id: ${id}` });
    }

    const updated = updateIntegration(id, { enabled, notes, config });
    res.json({ ok: true, integration: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update integration', message: String(err) });
  }
}
