/**
 * GET /api/admin/security/devices
 * Returns all trusted devices for the current admin.
 */
import type { Request, Response } from 'express';
import { listTrustedDevices } from '../../../../lib/trustedDeviceStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const adminId = (req as unknown as { admin?: { id: string } }).admin?.id ?? 'admin';
    const devices = await listTrustedDevices(adminId);
    res.json({ devices, total: devices.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load devices', message: String(err) });
  }
}
