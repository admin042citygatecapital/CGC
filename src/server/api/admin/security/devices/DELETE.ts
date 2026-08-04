/**
 * DELETE /api/admin/security/devices
 * Body: { token?: string; userId?: string; all?: boolean }
 * - token: terminate one customer device session
 * - userId: terminate all sessions for that customer
 * - all: true — terminate every active customer session (nuclear option)
 */
import type { Request, Response } from 'express';
import { terminateUserSession, terminateAllUserSessions, loadUserSessions } from '../../../../lib/securityStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const { token, userId, all } = req.body as { token?: string; userId?: string; all?: boolean };
  const ip = req.ip ?? 'unknown';
  const adminId = req.adminSession?.adminId;
  const email = req.adminSession?.email;

  if (all === true) {
    const count = terminateAllUserSessions();
    appendAudit({ event: 'customer_devices_purge_all', adminId, email, ip, meta: { count } });
    return res.json({ ok: true, message: `${count} customer session(s) terminated` });
  }

  if (userId) {
    const count = terminateAllUserSessions(userId);
    appendAudit({ event: 'customer_devices_purge_user', adminId, email, ip, meta: { userId, count } });
    return res.json({ ok: true, message: `${count} session(s) for ${userId} terminated` });
  }

  if (token) {
    const before = loadUserSessions().find(s => s.token === token);
    const ok = terminateUserSession(token);
    if (!ok) return res.status(404).json({ ok: false, error: 'Session not found' });
    appendAudit({ event: 'customer_device_terminated', adminId, email, ip, meta: { userId: before?.userId, device: before?.device } });
    return res.json({ ok: true, message: 'Device session terminated' });
  }

  return res.status(400).json({ ok: false, error: 'Provide token, userId, or all:true' });
}
