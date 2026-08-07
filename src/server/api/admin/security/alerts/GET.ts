/** GET /api/admin/security/alerts */
import type { Request, Response } from 'express';
import { loadAlerts, alertStats } from '../../../../lib/securityCenterStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const limit = parseInt(String(req.query.limit ?? '100'), 10);
    const alerts = loadAlerts(limit);
    const stats  = alertStats();
    res.json({ alerts, stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load alerts', message: String(err) });
  }
}
