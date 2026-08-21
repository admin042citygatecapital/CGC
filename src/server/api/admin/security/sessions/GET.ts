/**
 * GET /api/admin/security/sessions
 * Returns all active admin sessions with metadata.
 */
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { listSessions } from '../../../../lib/sessionStore.js';

function sessionReference(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default async function handler(_req: Request, res: Response) {
  const sessions = await listSessions();
  const safeSessions = sessions.map(({ token, ...session }) => ({
    ...session,
    token: sessionReference(token),
  }));
  return res.json({ sessions: safeSessions, total: safeSessions.length });
}
