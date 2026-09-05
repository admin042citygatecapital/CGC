import { getSumsubReadiness } from '../../../lib/onboardingProviderReadiness.js';
/**
 * GET /api/admin/integrations
 * Returns status of all integrations, or a single integration if ?id= is supplied.
 * Secrets are never exposed — only whether each secret is present or missing.
 */
import type { Request, Response } from 'express';
import { getAllIntegrations, getIntegration, type IntegrationId } from '../../../lib/integrationStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { id } = req.query as { id?: string };

    if (id) {
      const integration = await getIntegration(id as IntegrationId);
      if (!integration) return res.status(404).json({ error: `Unknown integration: ${id}` });
      return res.json({ integration });
    }

    const [integrations, sumsub] = await Promise.all([getAllIntegrations(), getSumsubReadiness()]);
    res.json({ integrations, sumsub });
  } catch {
    res.status(500).json({ error: 'Failed to load integrations' });
  }
}
