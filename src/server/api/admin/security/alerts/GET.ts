/** GET /api/admin/security/alerts */
import type { Request, Response } from 'express';
import { loadAlerts, alertStats } from '../../../../lib/securityCenterStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const requestedLimit = Number.parseInt(String(req.query.limit ?? '100'), 10);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 500)) : 100;
    const alerts = await loadAlerts(limit);
    const stats  = await alertStats();
    res.json({ alerts, stats });
  } catch {
    res.status(500).json({ error: 'Failed to load alerts' });
  }
}
