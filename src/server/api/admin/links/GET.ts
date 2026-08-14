import type { Request, Response } from 'express';
import { readLinks } from '../../../lib/linksStore.js';

export default async function handler(_req: Request, res: Response) {
  res.json({ links: await readLinks() });
}
