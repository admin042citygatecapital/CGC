/**
 * GET /api/cms/content
 * Public (no-auth) endpoint that serves the stored CMS content.
 * Used by public-facing pages to read admin-editable copy without
 * exposing the admin API.
 *
 * Cache-Control: 60s public so CDN/browsers cache it, but changes
 * propagate within a minute.
 */
import type { Request, Response } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { privateSubdirectory } from '../../../lib/storagePaths.js';

const STORE_FILE = privateSubdirectory('admin/cms.json');

export default function handler(_req: Request, res: Response) {
  try {
    if (!existsSync(STORE_FILE)) {
      return res
        .set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30')
        .json({ ok: true, data: {} });
    }
    const raw = readFileSync(STORE_FILE, 'utf-8');
    return res
      .set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30')
      .json({ ok: true, data: JSON.parse(raw) });
  } catch (err) {
    console.error('cms.content.get.error', err);
    return res.status(500).json({ error: 'Failed to load CMS content.' });
  }
}
