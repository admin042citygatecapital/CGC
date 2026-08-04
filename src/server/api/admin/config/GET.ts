/**
 * GET /api/admin/config
 * Query: section? — return just one AppConfig section instead of the
 * whole thing.
 */
import type { Request, Response } from 'express';
import { getConfig, getSection, type AppConfig } from '../../../lib/configStore.js';

const SECTIONS: (keyof AppConfig)[] = [
  'branding', 'theme', 'homepage', 'dashboardWidgets', 'notificationSettings',
  'maintenanceMode', 'featureToggles', 'exchangeRates', 'language', 'currency', 'timezone',
];

export default async function handler(req: Request, res: Response) {
  try {
    const { section } = req.query as { section?: string };
    if (section) {
      if (!SECTIONS.includes(section as keyof AppConfig)) {
        return res.status(400).json({ ok: false, error: `Unknown section. Valid: ${SECTIONS.join(', ')}` });
      }
      return res.json({ ok: true, section, data: getSection(section as keyof AppConfig) });
    }
    return res.json({ ok: true, config: getConfig() });
  } catch (err) {
    console.error('[admin/config GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load configuration' });
  }
}
