/**
 * GET /api/admin/support/notifications
 * Returns support notification settings.
 */
import type { Request, Response } from 'express';
import { readNotificationSettings } from '../../../../lib/supportStore.js';

export default function handler(_req: Request, res: Response) {
  return res.json(readNotificationSettings());
}
