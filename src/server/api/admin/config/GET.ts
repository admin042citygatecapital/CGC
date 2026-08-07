import type { Request, Response } from 'express';
import { getConfig } from '../../../lib/configStore.js';
import { buildEnvReport } from '../../../lib/envValidator.js';
import { readHomepageContent } from '../../../lib/homepageContent.js';

export default async function handler(req: Request, res: Response) {
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
      return res.json({ homepage: readHomepageContent() });
    }

    if (section) {
      const cfg = getConfig();
      if (!(section in cfg)) return res.status(400).json({ error: `Unknown section: ${section}` });
      return res.json({ [section]: (cfg as any)[section] });
    }

    // Full config — homepage comes from content file, rest from configStore
    const cfg = getConfig();
    const safe = {
      ...cfg,
      homepage:     readHomepageContent(),
      exchangeRates: { ...cfg.exchangeRates, apiKey: cfg.exchangeRates.apiKey ? '••••••••' : '' },
    };
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load config', message: String(err) });
  }
}
