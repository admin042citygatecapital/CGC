import type { Request, Response } from 'express';
import { readWebsiteSettings } from '../../../lib/websiteStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    res.json({ settings: await readWebsiteSettings() });
  } catch {
    res.status(503).json({ error: 'Website settings are temporarily unavailable.' });
  }
}
