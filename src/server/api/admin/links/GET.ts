import type { Request, Response } from 'express';
import { readLinks } from '../../../lib/linksStore.js';

export default function handler(_req: Request, res: Response) {
  res.json({ ok: true, links: readLinks() });
}
