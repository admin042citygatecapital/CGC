/**
 * POST /api/users/devices/revoke
 * Body: { deviceId: string }
 * Removes a trusted device from the authenticated customer's own list.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser } from '../../../../lib/userStore.js';
import { parseDevices } from '../../../../lib/customerDevices.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { deviceId } = req.body as { deviceId?: string };
  if (!deviceId) return res.status(400).json({ ok: false, error: 'deviceId is required' });

  const devices = parseDevices(user.trustedDevices);
  const remaining = devices.filter(d => d.id !== deviceId);
  if (remaining.length === devices.length) {
    return res.status(404).json({ ok: false, error: 'Device not found' });
  }

  await updateUser(user.id, { trustedDevices: remaining } as never);
  appendAudit({ event: 'user_device_revoked', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { deviceId } });

  return res.json({ ok: true, devices: remaining });
}
