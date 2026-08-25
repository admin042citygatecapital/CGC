/**
 * GET /api/admin/auth/trusted-devices
 * List all trusted devices for the authenticated admin.
 */
import type { Request, Response } from 'express';
import { listTrustedDevices } from '../../../../lib/trustedDeviceStore.js';

export default async function handler(req: Request, res: Response) {
  const adminId = req.adminSession?.adminId;
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });

  const devices = (await listTrustedDevices(adminId)).map(d => ({
    id:         d.id,
    adminId:    d.adminId,
    email:      d.email,
    name:       d.name,
    ip:         d.ip,
    ua:         d.ua,
    createdAt:  d.createdAt,
    expiresAt:  d.expiresAt,
    lastUsedAt: d.lastUsedAt,
  }));

  res.json({ devices, total: devices.length });
}
