/**
 * GET /api/users/devices
 * Returns the authenticated customer's own trusted devices.
 * See customerDevices.ts — genuinely empty until a device-registration
 * flow writes to user.trustedDevices (not built yet).
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { parseDevices } from '../../../lib/customerDevices.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const devices = parseDevices(user.trustedDevices);
  return res.json({ ok: true, devices });
}
