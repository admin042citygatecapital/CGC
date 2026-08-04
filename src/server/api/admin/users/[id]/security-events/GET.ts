/**
 * GET /api/admin/users/:id/security-events
 * Admin view of security flags raised against a specific customer
 * (reuses the same securityStore.ts flags shown on the Security Center).
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../../lib/userStore.js';
import { queryFlags } from '../../../../../lib/securityStore.js';

export default async function handler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const user = await findUserById(id);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  const result = queryFlags({ userId: id, limit: 200 });
  return res.json({ ok: true, flags: result.data, total: result.total });
}
