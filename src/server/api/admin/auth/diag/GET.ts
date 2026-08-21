/**
 * GET /api/admin/auth/diag
 * Lightweight credential + session diagnostic.
 * Returns format/length info only — never exposes actual hashes, tokens, or passwords.
 *
 * SECURITY: Protected by requireAdminAuth middleware (registered in entry.ts).
 * The ADMIN_UNLOCK_KEY check is a secondary guard for break-glass scenarios
 * where the admin session is unavailable. Key is read from the X-Unlock-Key
 * request header (NOT a query param) to keep it out of access logs.
 */
import type { Request, Response } from 'express';
import { findAdminByEmail } from '../../../../lib/adminCredentials.js';
import { listSessions } from '../../../../lib/sessionStore.js';
import { getSecret } from '#runtime/secrets';

function getUnlockKey(): string | undefined {
  const value = getSecret('ADMIN_UNLOCK_KEY');
  return typeof value === 'string' ? value : undefined;
}

export default async function handler(req: Request, res: Response) {
  // Primary guard: requireAdminAuth middleware (applied in entry.ts).
  // If we reach here without a session, fall back to the unlock key header.
  if (!req.adminSession) {
    const configuredKey = getUnlockKey();
    if (!configuredKey) {
      return res.status(503).json({ error: 'ADMIN_UNLOCK_KEY secret not configured.' });
    }
    // Read from header, NOT query param — keeps the key out of access logs
    const providedKey = req.headers['x-unlock-key'] as string | undefined;
    if (!providedKey || providedKey !== configuredKey) {
      return res.status(403).json({ error: 'Provide X-Unlock-Key header with the configured key.' });
    }
  }

  const admin = await findAdminByEmail('admin@citygate.capital');
  if (!admin) {
    return res.json({ ok: false, error: 'Admin record not found in ADMIN_USERS' });
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
      hashPrefix: admin.passwordHash.slice(0, 7),
      hashLength: admin.passwordHash.length,
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
