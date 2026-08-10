/**
 * GET /api/users/devices
 * Returns the customer's trusted/active devices derived from session metadata.
 * Every active session is represented as a device without exposing credentials.
 */
import type { Request, Response } from 'express';
import { listCustomerSessions } from '../../../lib/customerSessionStore.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  const token = req.customerToken;
  if (!user || !token) return res.status(401).json({ error: 'Authentication required' });
  const sessions = await listCustomerSessions(user.id, token);
  const devices = sessions.map(session => ({
    id: session.id,
    name: session.isCurrent ? 'Current Session' : 'Active Session',
    type: /mobile|android|iphone/i.test(session.ua) ? 'mobile' : 'desktop',
    browser: session.ua || 'Browser',
    os: '',
    ip: session.ip,
    location: '',
    lastSeen: session.lastSeenAt,
    addedAt: session.createdAt,
    current: session.isCurrent,
    trusted: session.isCurrent,
  }));

  return res.json({ devices });
}
