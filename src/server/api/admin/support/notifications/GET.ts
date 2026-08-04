/**
 * GET /api/admin/support/notifications
 * Read support notification settings (urgent-ticket alerts, stale-ticket
 * alerts, reopened-ticket alerts, and the admin email that receives them).
 */
import type { Request, Response } from 'express';
import { readNotificationSettings } from '../../../../lib/supportStore.js';

export default async function handler(_req: Request, res: Response) {
  try {
    return res.json({ ok: true, settings: readNotificationSettings() });
  } catch (err) {
    console.error('[admin/support/notifications GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load notification settings' });
  }
}
