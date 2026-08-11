import type { Request, Response } from 'express';
import { appendAudit } from '../../../../../lib/auditLog.js';
import { deleteAllCustomerSessions } from '../../../../../lib/customerSessionStore.js';
import { clearCustomerSessionCookie } from '../../../../../lib/customerSessionConfig.js';

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const revoked = await deleteAllCustomerSessions(user.id);
  clearCustomerSessionCookie(res);
  appendAudit({ event: 'customer_sessions_revoked_all', userId: user.id, email: user.email, ip: req.ip, meta: { revoked } });
  return res.json({ ok: true, revoked });
}
