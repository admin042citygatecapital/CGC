/**
 * GET /api/admin/users/:id/security-events
 * Returns security-related audit events for a specific customer.
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../../lib/userStore.js';
import { getAuditLog } from '../../../../../lib/auditLog.js';

const SECURITY_ACTIONS = new Set([
  'customer_login_failed',
  'login_failed',
  'brute_force_lockout',
  'account_locked',
  'account_unlocked',
  'password_reset_requested',
  'password_reset_completed',
  'admin_user_password_reset',
  'admin_user_2fa_reset',
  'admin_user_suspend',
  'admin_user_freeze',
  'admin_user_reactivate',
  'admin_user_deleted',
  'kyc_rejected',
  'kyc_approved',
  'fraud_flag',
  'suspicious_activity',
  'session_invalidated',
  'admin_user_approve_kyc',
  'admin_user_reject_kyc',
  'admin_user_created',
]);

export default async function handler(req: Request, res: Response) {
  const id = String(req.params.id ?? '');
  const limit  = Math.min(200, parseInt(String(req.query.limit ?? '50'), 10));

  if (!id) return res.status(400).json({ error: 'User ID required' });

  const user = await findUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const all = await getAuditLog({ limit: 10_000 });
  const events = all
    .filter(e =>
      (e.adminId === id || e.targetId === id || e.details?.userId === id || e.adminEmail?.toLowerCase() === user.email.toLowerCase()) &&
      SECURITY_ACTIONS.has(e.action)
    )
    .slice(0, limit);

  return res.json({ data: events, total: events.length });
}
