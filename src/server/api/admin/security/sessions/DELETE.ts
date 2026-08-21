/**
 * DELETE /api/admin/security/sessions
 * Terminate a specific session or all sessions for an admin.
 *
 * Body: { token?: string; adminId?: string; all?: boolean }
 * - token: terminate a specific session
 * - adminId: terminate all sessions for that admin
 * - all: true — terminate ALL sessions (nuclear option)
 */
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { deleteSession, deleteAllSessionsForAdmin, listSessions } from '../../../../lib/sessionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
function sessionReference(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
export default async function handler(req: Request, res: Response) {
  const { token, adminId, all } = req.body as { token?: string; adminId?: string; all?: boolean };
  const ip = req.ip ?? 'unknown';

  // The requesting admin's own token (to avoid self-termination)
  const authToken = req.adminToken ?? req.headers.authorization?.replace('Bearer ', '') ?? '';

  if (all === true) {
    const sessions = await listSessions();
    for (const s of sessions) {
      if (s.token !== authToken) await deleteSession(s.token); // don't kill own session
    }
    appendAudit({ event: 'admin_sessions_purge_all', ip, meta: { count: sessions.length } });
    return res.json({ ok: true, message: 'All other sessions terminated' });
  }

  if (adminId) {
    await deleteAllSessionsForAdmin(adminId);
    appendAudit({ event: 'admin_sessions_purge_user', ip, meta: { adminId } });
    return res.json({ ok: true, message: `All sessions for ${adminId} terminated` });
  }

  if (token) {
    const sessions = await listSessions();
    const matchingSession = sessions.find(session => sessionReference(session.token) === token);
    if (!matchingSession) return res.status(404).json({ error: 'Session not found' });
    await deleteSession(matchingSession.token);
    appendAudit({ event: 'admin_session_terminated', ip });
    return res.json({ ok: true, message: 'Session terminated' });
  }

  return res.status(400).json({ error: 'Provide token, adminId, or all:true' });
}
