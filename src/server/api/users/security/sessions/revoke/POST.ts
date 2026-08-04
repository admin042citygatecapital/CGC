/**
 * POST /api/users/security/sessions/revoke
 * Body: { tokenPreview: string }
 * Terminates one of the authenticated customer's own sessions, identified
 * by the truncated preview shown in the sessions list (the full token is
 * never sent back to the client — see GET).
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../../../lib/userStore.js';
import { listCustomerSessions, deleteCustomerSession } from '../../../../../lib/customerSessionStore.js';
import { appendAudit } from '../../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const currentToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(currentToken);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { tokenPreview } = req.body as { tokenPreview?: string };
  if (!tokenPreview) return res.status(400).json({ ok: false, error: 'tokenPreview is required' });

  const sessions = await listCustomerSessions(user.id);
  const target = sessions.find(s => s.token.slice(0, 8) + '...' === tokenPreview);
  if (!target) return res.status(404).json({ ok: false, error: 'Session not found' });

  await deleteCustomerSession(target.token);
  appendAudit({ event: 'user_session_revoked', userId: user.id, email: user.email, ip: req.ip ?? 'unknown' });

  return res.json({ ok: true });
}
