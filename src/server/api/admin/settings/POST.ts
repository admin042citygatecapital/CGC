/**
 * POST /api/admin/settings
 * Persist admin platform settings to disk.
 * Body: settings object (siteName, supportEmail, maintenanceMode, etc.)
 */
import type { Request, Response } from 'express';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { appendAudit } from '../../../lib/auditLog.js';

const STORE_DIR  = '/private/admin';
const STORE_FILE = join(STORE_DIR, 'settings.json');

export default function handler(req: Request, res: Response) {
  try {
    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid request body.' });
    }

    mkdirSync(STORE_DIR, { recursive: true });
    writeFileSync(STORE_FILE, JSON.stringify({ ...body, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');

    appendAudit({
      event: 'admin_settings_updated',
      ip: req.ip ?? 'unknown',
      meta: { fields: Object.keys(body) },
    });

    return res.json({ ok: true, message: 'Settings saved.' });
  } catch (err) {
    console.error('admin.settings.save.error', err);
    return res.status(500).json({ ok: false, error: 'Failed to save settings.' });
  }
}
