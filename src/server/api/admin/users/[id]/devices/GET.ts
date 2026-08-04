/**
 * GET /api/admin/users/:id/devices
 * Admin view of a specific customer's trusted devices.
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../../lib/userStore.js';
import { parseDevices } from '../../../../../lib/customerDevices.js';

export default async function handler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const user = await findUserById(id);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  return res.json({ ok: true, devices: parseDevices(user.trustedDevices) });
}
