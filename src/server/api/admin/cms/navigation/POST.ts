import type { Request, Response } from 'express';
import { saveNavigation } from '../../../../lib/cmsExtStore.js';
export default function handler(req: Request, res: Response) {
  try {
    const { links } = req.body ?? {};
    if (!Array.isArray(links)) return res.status(400).json({ error: 'links array required' });
    res.json({ ok: true, navigation: saveNavigation(links) });
  } catch (err) { res.status(500).json({ error: String(err) }); }
}
