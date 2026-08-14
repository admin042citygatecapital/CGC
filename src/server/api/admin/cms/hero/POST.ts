import type { Request, Response } from 'express';
import { saveHeroMedia } from '../../../../lib/cmsExtStore.js';
export default async function handler(req: Request, res: Response) {
  try {
    const body = req.body as Record<string, unknown>;
    const allowed = new Set(['heroImageUrl','heroImageAlt','heroVideoUrl','heroVideoType','heroVideoAutoplay','heroVideoMuted','heroVideoLoop','heroMediaType','backgroundOverlay']);
    if (!body || typeof body !== 'object' || Object.keys(body).some(key => !allowed.has(key)) || JSON.stringify(body).length > 20_000) return res.status(400).json({ error: 'Invalid hero configuration.' });
    res.json({ ok: true, hero: await saveHeroMedia(body, req.adminSession!.adminId) });
  } catch (err) { console.error('cms.hero.save_failed', err); res.status(500).json({ error: 'Unable to save hero configuration.' }); }
}
