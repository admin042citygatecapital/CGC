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
import { deleteSessionByHash, deleteAllSessionsForAdmin, listSessions } from '../../../../lib/sessionStore.js';
import { digestOpaqueToken, isSha256Digest } from '../../../../lib/tokenDigest.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { authorizeAdminRole, authorizeRecentAdminStepUp } from '../../../../lib/rbacMiddleware.js';
export default async function handler(req: Request, res: Response) {
  const { token, adminId, all, reason, confirmation } = req.body as { token?: string; adminId?: string; all?: boolean; reason?: string; confirmation?: string };
  const ip = req.ip ?? 'unknown';
  const session = req.adminSession;
  if (!authorizeAdminRole(req, res, 'SUPER_ADMIN')) return;
  if (!authorizeRecentAdminStepUp(req, res)) return;
  if (String(reason ?? '').trim().length < 8) return res.status(400).json({ error: 'A clear security reason is required.' });
  if (confirmation !== 'CONFIRM SESSION REVOCATION') return res.status(409).json({ error: 'Type CONFIRM SESSION REVOCATION to continue.' });

  // The requesting admin's own token (to avoid self-termination)
  const authToken = req.adminToken ?? '';
  const authTokenHash = authToken ? digestOpaqueToken(authToken) : '';

  if (all === true) {
    const sessions = await listSessions();
    for (const s of sessions) {
      if (s.token !== authTokenHash) await deleteSessionByHash(s.token); // don't kill own session
    }
    appendAudit({ event: 'admin_sessions_purge_all', adminId: session?.adminId, email: session?.email, ip, reason, meta: { count: sessions.length, role: session?.role } });
    return res.json({ ok: true, message: 'All other sessions terminated' });
  }

  if (adminId) {
    await deleteAllSessionsForAdmin(adminId);
    appendAudit({ event: 'admin_sessions_purge_user', adminId: session?.adminId, email: session?.email, ip, reason, meta: { targetAdminId: adminId, role: session?.role } });
    return res.json({ ok: true, message: `All sessions for ${adminId} terminated` });
  }

  if (token) {
    if (!isSha256Digest(token)) return res.status(404).json({ error: 'Session not found' });
    const sessions = await listSessions();
    const matchingSession = sessions.find(session => session.token === token.toLowerCase());
    if (!matchingSession) return res.status(404).json({ error: 'Session not found' });
    await deleteSessionByHash(matchingSession.token);
    appendAudit({ event: 'admin_session_terminated', adminId: session?.adminId, email: session?.email, ip, reason, meta: { role: session?.role } });
    return res.json({ ok: true, message: 'Session terminated' });
  }

  return res.status(400).json({ error: 'Provide token, adminId, or all:true' });
}
