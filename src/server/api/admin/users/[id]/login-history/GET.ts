/**
 * GET /api/admin/users/:id/login-history
 * Returns login events for a specific customer from the audit log.
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../../lib/userStore.js';
import { getAuditLog } from '../../../../../lib/auditLog.js';

const LOGIN_ACTIONS = new Set([
  'customer_login_success',
  'customer_login_failed',
  'customer_logout',
  'customer_session_expired',
  'customer_login',
  'login_success',
  'login_failed',
  'logout',
]);

export default async function handler(req: Request, res: Response) {
  const id = String(req.params.id ?? '');
  const limit  = Math.min(200, parseInt(String(req.query.limit ?? '50'), 10));

  if (!id) return res.status(400).json({ error: 'User ID required' });

  const user = await findUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const all = await getAuditLog({ limit: 10_000 });
  const history = all
    .filter(e =>
      (e.adminId === id || e.targetId === id || e.details?.userId === id || e.adminEmail?.toLowerCase() === user.email.toLowerCase()) &&
      LOGIN_ACTIONS.has(e.action)
    )
    .slice(0, limit);

  // Synthetic fallback if no audit events found
  const synthetic = history.length === 0 && user.lastLoginAt ? [{
    id:         'synthetic_0',
    adminId:    user.id,
    adminEmail: user.email,
    action:     'login_success',
    ip:         user.lastLoginIp ?? '—',
    ts:         new Date(user.lastLoginAt),
    meta:       {},
  }] : [];

  return res.json({ data: [...history, ...synthetic], total: history.length + synthetic.length });
}
