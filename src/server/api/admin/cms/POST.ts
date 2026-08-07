/**
 * POST /api/admin/cms
 * Persist CMS content settings to disk.
 * Body: CMS form fields (heroTitle, heroSubtitle, heroCTA, metaTitle, etc.)
 */
import type { Request, Response } from 'express';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { appendAudit } from '../../../lib/auditLog.js';

const STORE_DIR  = '/private/admin';
const STORE_FILE = join(STORE_DIR, 'cms.json');

export default function handler(req: Request, res: Response) {
  try {
    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body.' });
    }

    mkdirSync(STORE_DIR, { recursive: true });
    writeFileSync(STORE_FILE, JSON.stringify({ ...body, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');

    appendAudit({
      event: 'admin_cms_updated',
      ip: req.ip ?? 'unknown',
      meta: { fields: Object.keys(body) },
    });

    return res.json({ ok: true, message: 'CMS content saved.' });
  } catch (err) {
    console.error('admin.cms.save.error', err);
    return res.status(500).json({ error: 'Failed to save CMS content.' });
  }
}
