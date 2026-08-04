/**
 * GET /api/admin/auth/diag
 * Lightweight credential + session diagnostic. Format/length info only —
 * never exposes actual hashes, tokens, or passwords.
 * Protected by ADMIN_UNLOCK_KEY.
 *
 * Query: ?unlockKey=<ADMIN_UNLOCK_KEY>
 *
 * Reworked against the current backend, and deliberately NOT a straight
 * port of the source version:
 *  - The original tested a specific plaintext password ('<<BDM0147') against
 *    the live admin hash and returned whether it matched. That plaintext
 *    string is itself a secret checked into source control — this endpoint
 *    must not carry it forward. If that string is a real credential, rotate
 *    ADMIN_PASSWORD_HASH immediately.
 *  - The original fell back to a hardcoded default unlock key
 *    ('CGC_UNLOCK_2026') when ADMIN_UNLOCK_KEY wasn't set, so the endpoint
 *    was unprotected out of the box. This now requires ADMIN_UNLOCK_KEY to
 *    be explicitly configured — with no key set, the endpoint is disabled
 *    (503) rather than open behind a guessable public default.
 *  - listSessions() is async under the DB-backed sessionStore.ts (the
 *    original store was synchronous flat-file only).
 */
import type { Request, Response } from 'express';
import { getSecret } from '#airo/secrets';
import { findAdminByEmail } from '../../../../lib/adminCredentials.js';
import { listSessions } from '../../../../lib/sessionStore.js';

export default async function handler(req: Request, res: Response) {
  const { unlockKey } = req.query as { unlockKey?: string };
  const configuredKey = getSecret('ADMIN_UNLOCK_KEY');

  if (!configuredKey) {
    return res.status(503).json({ ok: false, error: 'ADMIN_UNLOCK_KEY is not configured — this diagnostic endpoint is disabled' });
  }
  if (!unlockKey || unlockKey !== configuredKey) {
    return res.status(403).json({ ok: false, error: 'Provide ?unlockKey=<key>' });
  }

  const admin = await findAdminByEmail('admin@citygate.capital');
  if (!admin) {
    return res.json({ ok: false, error: 'Admin record not found — check ADMIN_PASSWORD_HASH' });
  }

  const sessions = await listSessions();
  const now = Date.now();
  const activeSessions = sessions.filter(s => {
    const lastSeen = s.lastSeenAt ?? s.createdAt;
    return now - new Date(lastSeen).getTime() < 60 * 60_000; // active in last 60 min
  });

  return res.json({
    ok: true,
    admin: {
      id:         admin.id,
      email:      admin.email,
      name:       admin.name,
      role:       admin.role,
      hashPrefix: admin.passwordHash.slice(0, 8),
      hashLength: admin.passwordHash.length,
      hashFormat: admin.passwordHash.startsWith('100000:') ? 'pbkdf2' : admin.passwordHash ? 'unknown' : 'not_set',
    },
    sessions: {
      total:  sessions.length,
      active: activeSessions.length,
      list:   activeSessions.map(s => ({
        tokenPrefix: s.token.slice(0, 8) + '...',
        email:       s.email,
        role:        s.role,
        createdAt:   s.createdAt,
        lastSeenAt:  s.lastSeenAt,
        ip:          s.ip,
      })),
    },
  });
}
