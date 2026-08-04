/**
 * GET /api/admin/security/devices
 * Active customer device/session records (device, browser, OS, IP,
 * country) — distinct from admin/security/sessions (admin panel logins)
 * and admin/auth/trusted-devices (an individual admin's own trusted
 * browser cookies). Query: userId to filter to one customer.
 */
import type { Request, Response } from 'express';
import { loadUserSessions } from '../../../../lib/securityStore.js';

export default async function handler(req: Request, res: Response) {
  try {
    const { userId } = req.query as { userId?: string };
    let sessions = loadUserSessions();
    if (userId) sessions = sessions.filter(s => s.userId === userId);
    return res.json({ ok: true, devices: sessions, total: sessions.length });
  } catch (err) {
    console.error('[admin/security/devices GET] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to load device sessions' });
  }
}
