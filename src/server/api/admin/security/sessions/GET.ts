/**
 * GET /api/admin/security/sessions
 * Returns all active admin sessions with metadata.
 *
 * Tokens are truncated (matching admin/auth/diag/GET.ts's convention) —
 * a full 64-char token is a live bearer credential, and returning it here
 * would let any admin able to view this list impersonate any other admin.
 */
import type { Request, Response } from 'express';
import { listSessions } from '../../../../lib/sessionStore.js';

export default async function handler(_req: Request, res: Response) {
  const sessions = await listSessions();
  const masked = sessions.map(({ token, ...rest }) => ({ ...rest, tokenPreview: token.slice(0, 8) + '...' }));
  return res.json({ ok: true, sessions: masked, total: masked.length });
}
