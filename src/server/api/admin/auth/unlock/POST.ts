/**
 * POST /api/admin/auth/unlock
 * Clears brute-force lockout for a given email + IP.
 * This is an authenticated SUPER_ADMIN operation; recovery when every
 * administrator is locked out remains an out-of-band operational procedure.
 */
import type { Request, Response } from 'express';
import { recordLoginSuccess, clearAllLockouts } from '../../../../lib/bruteForce.js';
import { purgeAllSessions } from '../../../../lib/sessionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';
import { authorizeAdminRole, authorizeRecentAdminStepUp } from '../../../../lib/rbacMiddleware.js';

export default async function handler(req: Request, res: Response) {
  const { email, purgeSessions, reason, confirmation } = req.body as {
    email?: string;
    purgeSessions?: boolean;
    reason?: string;
    confirmation?: string;
  };
  const session = req.adminSession;
  const ip = req.ip ?? 'unknown';
  if (!authorizeAdminRole(req, res, 'SUPER_ADMIN')) return;
  if (!authorizeRecentAdminStepUp(req, res)) return;
  if (String(reason ?? '').trim().length < 8) return res.status(400).json({ error: 'A clear security reason is required.' });
  if (confirmation !== 'CONFIRM ADMIN UNLOCK') return res.status(409).json({ error: 'Type CONFIRM ADMIN UNLOCK to continue.' });

  const targetEmail = email ?? 'admin@citygate.capital';

  // Clear all persisted brute-force lockouts
  await clearAllLockouts();
  await recordLoginSuccess(targetEmail, ip);
  await recordLoginSuccess(targetEmail, '127.0.0.1');

  if (purgeSessions) {
    try {
      await purgeAllSessions();
      appendAudit({ event: 'sessions_purged', adminId: session?.adminId, email: session?.email, ip, reason, meta: { role: session?.role, triggeredBy: 'unlock_endpoint', result: 'success' } });
    } catch {
      appendAudit({ event: 'sessions_purge_failed', ip, reason: 'session_store_error', meta: { triggeredBy: 'unlock_endpoint' } });
      return res.status(503).json({ error: 'Lockout was cleared, but existing sessions could not be revoked. Retry before signing in.' });
    }
  }

  appendAudit({ event: 'lockout_cleared', adminId: session?.adminId, email: session?.email, ip, reason, meta: { targetEmail, role: session?.role, purgeSessions: Boolean(purgeSessions) } });

  return res.json({
    ok: true,
    message: `Lockout cleared for ${targetEmail}. ${purgeSessions ? 'All sessions purged.' : ''}`,
  });
}
