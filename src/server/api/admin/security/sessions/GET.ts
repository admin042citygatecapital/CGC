/**
 * GET /api/admin/security/sessions
 * Returns all active admin sessions with metadata.
 */
import type { Request, Response } from 'express';
import { listSessions } from '../../../../lib/sessionStore.js';

export default async function handler(_req: Request, res: Response) {
  const sessions = await listSessions();
  return res.json({ sessions, total: sessions.length });
}
