/**
 * GET /api/admin/security/sessions
 * Returns all active admin sessions with metadata.
 */
import type { Request, Response } from 'express';
import { listSessions } from '../../../../lib/sessionStore.js';

export default async function handler(_req: Request, res: Response) {
  const sessions = await listSessions();
  // listSessions returns only persisted SHA-256 references, never bearer
  // credentials. Preserve the existing response field for API compatibility.
  const safeSessions = sessions.map(({ token, ...session }) => ({ ...session, token }));
  return res.json({ sessions: safeSessions, total: safeSessions.length });
}
