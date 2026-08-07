/**
 * GET /api/admin/settings
 * Return the currently saved platform settings, or null if none saved yet.
 */
import type { Request, Response } from 'express';
import { readFileSync, existsSync } from 'node:fs';

const STORE_FILE = '/private/admin/settings.json';

export default function handler(req: Request, res: Response) {

  try {
    if (!existsSync(STORE_FILE)) return res.json({ ok: true, data: null });
    const raw = readFileSync(STORE_FILE, 'utf-8');
    return res.json({ ok: true, data: JSON.parse(raw) });
  } catch (err) {
    console.error('admin.settings.get.error', err);
    return res.status(500).json({ error: 'Failed to load settings.' });
  }
}
