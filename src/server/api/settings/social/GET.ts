/**
 * GET /api/settings/social
 * Public endpoint — returns enabled social links for the public site footer.
 */
import type { Request, Response } from 'express';
import { readSocialLinks } from '../../../lib/socialStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    const links = (await readSocialLinks()).filter(link => link.enabled && link.url);
    return res.json({ links });
  } catch {
    return res.json({ links: [] });
  }
}
