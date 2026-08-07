/**
 * DELETE /api/admin/auth/trusted-devices
 * Body: { token?: string; all?: boolean }
 */
import type { Request, Response } from 'express';
import { revokeTrustedDevice, revokeAllTrustedDevices, listTrustedDevices, type TrustedDevice } from '../../../../lib/trustedDeviceStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const adminId = req.adminSession?.adminId;
  const email   = req.adminSession?.email ?? 'unknown';
  const ip      = req.ip ?? 'unknown';
  if (!adminId) return res.status(401).json({ error: 'Unauthorized' });

  const { token, all } = req.body as { token?: string; all?: boolean };

  if (all === true) {
    await revokeAllTrustedDevices(adminId);
    appendAudit({ event: 'trusted_devices_revoke_all', adminId, email, ip });
    return res.json({ ok: true, message: 'All trusted devices revoked' });
  }

  if (token) {
    const devices = await listTrustedDevices(adminId);
    const match = devices.find((d: TrustedDevice & { token: string }) => d.token.startsWith(token.slice(0, 8)));
    if (!match) return res.status(404).json({ error: 'Device not found' });
    await revokeTrustedDevice(match.token);
    appendAudit({ event: 'trusted_device_revoked', adminId, email, ip, meta: { device: match.name } });
    return res.json({ ok: true, message: `Device "${match.name}" revoked` });
  }

  return res.status(400).json({ error: 'Provide token or all:true' });
}
