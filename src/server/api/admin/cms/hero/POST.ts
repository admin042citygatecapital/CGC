import type { Request, Response } from 'express';
import { saveHeroMedia } from '../../../../lib/cmsExtStore.js';
export default function handler(req: Request, res: Response) {
  try { res.json({ ok: true, hero: saveHeroMedia(req.body ?? {}) }); }
  catch (err) { res.status(500).json({ error: String(err) }); }
}
