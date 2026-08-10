/**
 * GET /api/users/security/sessions
 * Returns active sessions for the customer.
 */
import type { Request, Response } from 'express';
import { listCustomerSessions } from '../../../../lib/customerSessionStore.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  const token = req.customerToken;
  if (!user || !token) return res.status(401).json({ error: 'Authentication required' });
  const rows = await listCustomerSessions(user.id, token);
  const sessions = rows.map(session => ({
    id: session.id,
    device: session.ua || 'Browser session',
    ip: session.ip,
    location: '',
    lastSeen: session.lastSeenAt,
    current: session.isCurrent,
  }));

  return res.json({ sessions });
}
