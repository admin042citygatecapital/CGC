import type { Request, Response } from 'express';
import { writeSocialLinks } from '../../../lib/socialStore.js';

export default function handler(req: Request, res: Response) {
  const { links } = req.body;
  if (!Array.isArray(links)) return res.status(400).json({ ok: false, error: 'links must be an array' });
  writeSocialLinks(links);
  res.json({ ok: true });
}
