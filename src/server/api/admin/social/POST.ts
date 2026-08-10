import type { Request, Response } from 'express';
import { writeSocialLinks } from '../../../lib/socialStore.js';

export default function handler(req: Request, res: Response) {
  const { links } = req.body;
  if (!Array.isArray(links)) return res.status(400).json({ error: 'links must be an array' });
  const session = req.adminSession!;
  return writeSocialLinks(links, session.email || session.adminId)
    .then(savedLinks => res.json({ ok: true, links: savedLinks }))
    .catch(error => res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid social profile settings' }));
}
