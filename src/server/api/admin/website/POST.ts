import type { Request, Response } from 'express';
import { writeWebsiteSettings } from '../../../lib/websiteStore.js';

export default function handler(req: Request, res: Response) {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings required' });
  writeWebsiteSettings(settings);
  res.json({ ok: true });
}
