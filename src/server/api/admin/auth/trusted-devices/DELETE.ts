/**
 * DELETE /api/admin/auth/trusted-devices
 * Body: { deviceId?: string; all?: boolean }
 */
import type { Request, Response } from 'express';
import { revokeTrustedDevice, revokeAllTrustedDevices, listTrustedDevices } from '../../../../lib/trustedDeviceStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const adminId = req.adminSession?.adminId;
  const email   = req.adminSession?.email ?? 'unknown';
  const ip      = req.ip ?? 'unknown';
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });

  const { deviceId, all } = req.body as { deviceId?: string; all?: boolean };

  if (all === true) {
    await revokeAllTrustedDevices(adminId);
    appendAudit({ event: 'trusted_devices_revoke_all', adminId, email, ip });
    return res.json({ ok: true, message: 'All trusted devices revoked' });
  }

  if (deviceId) {
    const devices = await listTrustedDevices(adminId);
    const match = devices.find(device => device.id === deviceId);
    if (!match) return res.status(404).json({ error: 'Device not found' });
    const revoked = await revokeTrustedDevice(adminId, deviceId);
    if (!revoked) return res.status(404).json({ error: 'Device not found' });
    appendAudit({ event: 'trusted_device_revoked', adminId, email, ip, meta: { deviceId, device: match.name } });
    return res.json({ ok: true, message: `Device "${match.name}" revoked` });
  }

  return res.status(400).json({ error: 'Provide deviceId or all:true' });
}
