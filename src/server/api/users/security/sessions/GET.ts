/**
 * GET /api/users/security/sessions
 * Returns the authenticated customer's own active sessions.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../lib/userStore.js';
import { listCustomerSessions } from '../../../../lib/customerSessionStore.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const currentToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(currentToken);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const sessions = await listCustomerSessions(user.id);
  const masked = sessions.map(s => ({
    ...s,
    token: undefined,
    tokenPreview: s.token.slice(0, 8) + '...',
    isCurrent: s.token === currentToken,
  }));

  return res.json({ ok: true, sessions: masked });
}
