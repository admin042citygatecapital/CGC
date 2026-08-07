/**
 * GET /api/admin/auth/trusted-devices
 * List all trusted devices for the authenticated admin.
 */
import type { Request, Response } from 'express';
import { listTrustedDevices, type TrustedDevice } from '../../../../lib/trustedDeviceStore.js';

export default async function handler(req: Request, res: Response) {
  const adminId = req.adminSession?.adminId;
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });

  const devices = (await listTrustedDevices(adminId)).map((d: TrustedDevice & { token: string }) => ({
    token:      d.token.slice(0, 8) + '...',
    name:       d.name,
    ip:         d.ip,
    createdAt:  d.createdAt,
    expiresAt:  d.expiresAt,
    lastUsedAt: d.lastUsedAt,
  }));

  res.json({ devices });
}
