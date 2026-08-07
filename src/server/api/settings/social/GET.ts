/**
 * GET /api/settings/social
 * Public endpoint — returns enabled social links for the public site footer.
 */
import type { Request, Response } from 'express';
import { readSocialLinks } from '../../../lib/socialStore.js';

export default function handler(_req: Request, res: Response) {
  const links = readSocialLinks().filter((l: any) => l.enabled && l.url);
  return res.json({ links });
}
