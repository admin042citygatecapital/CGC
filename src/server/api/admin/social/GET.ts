import type { Request, Response } from 'express';
import { readSocialLinks } from '../../../lib/socialStore.js';

export default function handler(_req: Request, res: Response) {
  res.json({ links: readSocialLinks() });
}
