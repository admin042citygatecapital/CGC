/**
 * GET /api/admin/support/notifications
 * Returns support notification settings.
 */
import type { Request, Response } from 'express';
import { readNotificationSettings } from '../../../../lib/supportDatabaseStore.js';

export default async function handler(_req: Request, res: Response) {
  return res.json(await readNotificationSettings());
}
