/**
 * POST /api/admin/auth/unlock
 * Clears brute-force lockout for a given email + IP.
 * Protected by a static unlock secret (ADMIN_UNLOCK_KEY) so it can be
 * called even when the admin is locked out (no session required).
 *
 * Body: { email, unlockKey }
 * unlockKey must match the ADMIN_UNLOCK_KEY secret, or fall back to
 * the compiled default "CGC_UNLOCK_2026" for emergency access.
 */
import type { Request, Response } from 'express';
import { recordLoginSuccess, clearAllLockouts } from '../../../../lib/bruteForce.js';
import { purgeAllSessions } from '../../../../lib/sessionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

const DEFAULT_UNLOCK_KEY = 'CGC_UNLOCK_2026';

function getUnlockKey(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSecret } = require('#airo/secrets') as { getSecret: (k: string) => string | undefined };
    return getSecret('ADMIN_UNLOCK_KEY') ?? DEFAULT_UNLOCK_KEY;
  } catch { return DEFAULT_UNLOCK_KEY; }
}

export default function handler(req: Request, res: Response) {
  const { email, unlockKey, purgeSessions } = req.body as {
    email?: string;
    unlockKey?: string;
    purgeSessions?: boolean;
  };

  if (!email || !unlockKey) return res.status(400).json({ ok: false, error: 'email and unlockKey are required' });

  const ip = req.ip ?? 'unknown';

  if (!unlockKey || unlockKey !== getUnlockKey()) {
    appendAudit({ event: 'unlock_rejected', ip, meta: { email } });
    return res.status(403).json({ ok: false, error: 'Invalid unlock key' });
  }

  const targetEmail = email ?? 'admin@citygate.capital';

  // Clear all persisted brute-force lockouts
  clearAllLockouts();
  // Also clear in-memory for this specific email+IP (belt-and-suspenders)
  recordLoginSuccess(targetEmail, ip);
  recordLoginSuccess(targetEmail, '127.0.0.1');

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
