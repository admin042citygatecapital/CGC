/**
 * DELETE /api/admin/security/devices
 * Body: { token: string } | { all: true }
 */
import type { Request, Response } from 'express';
import { revokeTrustedDevice, revokeAllTrustedDevices } from '../../../../lib/trustedDeviceStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { token, all } = req.body as { token?: string; all?: boolean };
    const adminId = (req as unknown as { admin?: { id: string } }).admin?.id ?? 'admin';

    if (all) {
      await revokeAllTrustedDevices(adminId);
      return res.json({ ok: true, message: 'All trusted devices revoked' });
    }
    if (token) {
      await revokeTrustedDevice(token);
      return res.json({ ok: true, message: 'Device revoked' });
    }
    res.status(400).json({ error: 'Provide token or all:true' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke device', message: String(err) });
  }
}
