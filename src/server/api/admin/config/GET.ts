import type { Request, Response } from 'express';
import { getConfig, readWorkflowControls, redactConfigSecrets } from '../../../lib/configStore.js';
import { buildEnvReport } from '../../../lib/envValidator.js';
import { homepageAdminView, readHomepageDocument } from '../../../lib/homepageCmsStore.js';

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { section } = req.query as { section?: string };

    if (section === 'env') {
      const report = buildEnvReport();
      const safe = report.variables.map(r => ({
        name:        r.name,
        service:     r.service,
        level:       r.level,
        description: r.description,
        status:      r.status,
        isPublic:    r.isPublic ?? false,
      }));
      return res.json({ env: safe });
    }

    // Homepage section reads from the actual content file (virtual:content source of truth)
    if (section === 'homepage') {
      return res.json({ homepage: homepageAdminView((await readHomepageDocument()).content) });
    }

    if (section) {
      const cfg = redactConfigSecrets(getConfig());
      if (section === 'featureToggles') cfg.featureToggles = { ...cfg.featureToggles, ...await readWorkflowControls() };
      if (!Object.prototype.hasOwnProperty.call(cfg, section)) return res.status(400).json({ error: `Unknown section: ${section}` });
      return res.json({ [section]: (cfg as any)[section] });
    }

    // Full config — homepage comes from content file, rest from configStore
    const cfg = getConfig();
    const safe = {
      ...redactConfigSecrets(cfg),
      featureToggles: { ...cfg.featureToggles, ...await readWorkflowControls() },
      homepage:     homepageAdminView((await readHomepageDocument()).content),
    };
    res.json(safe);
  } catch (err) {
    console.error('admin.config.read.error', { errorType: err instanceof Error ? err.name : 'UnknownError' });
    res.status(500).json({ error: 'Failed to load configuration.' });
  }
}
