/**
 * GET /api/config/tawk-widget
 *
 * Returns only the public tawk.to embed identifiers and the administrator's
 * enable switch. No API credential, customer identity, or conversation data is
 * exposed through this endpoint.
 */
import type { Request, Response } from 'express';
import { getTawkWidgetConfig } from '../../../lib/integrationStore.js';

export default async function handler(_req: Request, res: Response) {
  const config = await getTawkWidgetConfig();
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(config);
}
