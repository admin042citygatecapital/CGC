import type { Request, Response } from 'express';
import { listSocialShares, readSocialLinks } from '../../../lib/socialStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    const [links, shares] = await Promise.all([readSocialLinks(), listSocialShares()]);
    return res.json({ links, shares });
  } catch (error) {
    console.error('admin.social.get.error', error);
    return res.status(500).json({ error: 'Failed to load social media settings' });
  }
}
