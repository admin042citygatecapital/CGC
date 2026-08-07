/**
 * POST /api/admin/auth/unlock
 * Clears brute-force lockout for a given email + IP.
 * Protected by the ADMIN_UNLOCK_KEY secret so it can be called even when
 * the admin is locked out (no session required).
 *
 * Body: { email, unlockKey }
 * unlockKey must match the ADMIN_UNLOCK_KEY secret exactly.
 */
import type { Request, Response } from 'express';
import { recordLoginSuccess, clearAllLockouts } from '../../../../lib/bruteForce.js';
import { purgeAllSessions } from '../../../../lib/sessionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

function getUnlockKey(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSecret } = require('#airo/secrets') as { getSecret: (k: string) => string | undefined };
    return getSecret('ADMIN_UNLOCK_KEY');
  } catch { return undefined; }
}

export default async function handler(req: Request, res: Response) {
  const { email, unlockKey, purgeSessions } = req.body as {
    email?: string;
    unlockKey?: string;
    purgeSessions?: boolean;
  };

  const ip = req.ip ?? 'unknown';

  const configuredKey = getUnlockKey();
  if (!configuredKey) {
    appendAudit({ event: 'unlock_rejected', ip, meta: { email, reason: 'ADMIN_UNLOCK_KEY secret not configured' } });
    return res.status(503).json({ error: 'Unlock key not configured. Set the ADMIN_UNLOCK_KEY secret.' });
  }

  if (!unlockKey || unlockKey !== configuredKey) {
    appendAudit({ event: 'unlock_rejected', ip, meta: { email } });
    return res.status(403).json({ error: 'Invalid unlock key' });
  }

  const targetEmail = email ?? 'admin@citygate.capital';

  // Clear all persisted brute-force lockouts
  await clearAllLockouts();
  await recordLoginSuccess(targetEmail, ip);
  await recordLoginSuccess(targetEmail, '127.0.0.1');

  if (purgeSessions) {
    purgeAllSessions();
    appendAudit({ event: 'sessions_purged', ip, meta: { triggeredBy: 'unlock_endpoint' } });
  }

  appendAudit({ event: 'lockout_cleared', ip, meta: { email: targetEmail } });

  return res.json({
    ok: true,
    message: `Lockout cleared for ${targetEmail}. ${purgeSessions ? 'All sessions purged.' : ''}`,
  });
}
