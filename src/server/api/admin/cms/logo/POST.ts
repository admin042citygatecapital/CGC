import type { Request, Response } from 'express';
import { saveLogoConfig } from '../../../../lib/cmsExtStore.js';
export default async function handler(req: Request, res: Response) {
  try {
    const body = req.body as Record<string, unknown>;
    const allowed = new Set(['primaryLogoUrl','darkLogoUrl','faviconUrl','logoAlt','logoWidth','logoHeight']);
    if (!body || typeof body !== 'object' || Object.keys(body).some(key => !allowed.has(key)) || JSON.stringify(body).length > 20_000) return res.status(400).json({ error: 'Invalid logo configuration.' });
    res.json({ ok: true, logo: await saveLogoConfig(body, req.adminSession!.adminId) });
  } catch (err) { console.error('cms.logo.save_failed', err); res.status(500).json({ error: 'Unable to save logo configuration.' }); }
}
