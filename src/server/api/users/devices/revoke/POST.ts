/**
 * POST /api/users/devices/revoke
 * Revoke the session represented by a customer device.
 */
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { revokeCustomerSession } from '../../../../lib/customerSessionStore.js';
import { clearCustomerSessionCookie } from '../../../../lib/customerSessionConfig.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  const token = req.customerToken;
  if (!user || !token) return res.status(401).json({ error: 'Authentication required' });
  const deviceId = typeof req.body?.deviceId === 'string' ? req.body.deviceId : '';
  const currentId = crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
  const revoked = await revokeCustomerSession(user.id, deviceId);
  if (!revoked) return res.status(404).json({ error: 'Device session not found' });
  if (deviceId === currentId) clearCustomerSessionCookie(res);
  return res.json({ ok: true, currentSessionRevoked: deviceId === currentId });
}
