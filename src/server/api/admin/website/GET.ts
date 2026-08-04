import type { Request, Response } from 'express';
import { readWebsiteSettings } from '../../../lib/websiteStore.js';

export default function handler(_req: Request, res: Response) {
  res.json({ ok: true, settings: readWebsiteSettings() });
}
