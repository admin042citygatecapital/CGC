/**
 * POST /api/users/security/sessions/revoke
 * Revoke one session owned by the authenticated customer.
 */
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { revokeCustomerSession } from '../../../../../lib/customerSessionStore.js';
import { clearCustomerSessionCookie } from '../../../../../lib/customerSessionConfig.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  const token = req.customerToken;
  if (!user || !token) return res.status(401).json({ error: 'Authentication required' });
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
  const currentId = crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
  const revoked = await revokeCustomerSession(user.id, sessionId);
  if (!revoked) return res.status(404).json({ error: 'Session not found' });
  if (sessionId === currentId) clearCustomerSessionCookie(res);

  return res.json({ ok: true, currentSessionRevoked: sessionId === currentId });
}
