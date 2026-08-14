import type { Request, Response } from 'express';
import { saveNavigation } from '../../../../lib/cmsExtStore.js';
export default async function handler(req: Request, res: Response) {
  try {
    const { links } = req.body ?? {};
    if (!Array.isArray(links)) return res.status(400).json({ error: 'links array required' });
    if (links.length > 100 || JSON.stringify(links).length > 100_000 || links.some(link => !link || typeof link !== 'object' || typeof link.label !== 'string' || typeof link.href !== 'string')) return res.status(400).json({ error: 'Invalid navigation links.' });
    res.json({ ok: true, navigation: await saveNavigation(links, req.adminSession!.adminId) });
  } catch (err) { console.error('cms.navigation.save_failed', err); res.status(500).json({ error: 'Unable to save navigation.' }); }
}
