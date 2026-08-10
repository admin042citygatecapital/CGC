/**
 * GET /api/admin/cms
 * Return the currently saved CMS content, or defaults if none saved yet.
 */
import type { Request, Response } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { privateSubdirectory } from '../../../lib/storagePaths.js';

const STORE_FILE = privateSubdirectory('admin/cms.json');

export default function handler(req: Request, res: Response) {

  try {
    if (!existsSync(STORE_FILE)) return res.json({ ok: true, data: null });
    const raw = readFileSync(STORE_FILE, 'utf-8');
    return res.json({ ok: true, data: JSON.parse(raw) });
  } catch (err) {
    console.error('admin.cms.get.error', err);
    return res.status(500).json({ error: 'Failed to load CMS content.' });
  }
}
