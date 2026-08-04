/**
 * POST /api/admin/users/edit
 * Full client account editor — SUPER_ADMIN only.
 *
 * Editable fields: name, email, phone, country, status, kycStatus,
 * emailVerified, balance (display), bankName, bankAccountNumber,
 * bankRoutingNumber, bankSwift, bankIban, walletBtc, walletEth, walletUsdt.
 *
 * All changes are audit-logged with: adminId, userId, IP, timestamp,
 * previous values, and new values.
 */
import type { Request, Response } from 'express';
import { findUserById, updateUser } from '../../../../lib/userStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

// Fields the admin is allowed to patch
const ALLOWED_FIELDS = new Set([
  'name', 'email', 'phone', 'country',
  'status', 'kycStatus', 'emailVerified', 'balance',
  'bankName', 'bankAccountNumber', 'bankRoutingNumber', 'bankSwift', 'bankIban',
  'walletBtc', 'walletEth', 'walletUsdt',
]);

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { userId, patch } = req.body as { userId?: string; patch?: Record<string, unknown> };

  if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });
  if (!patch || typeof patch !== 'object') return res.status(400).json({ ok: false, error: 'patch is required' });

  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  // Filter to only allowed fields
  const safePatch: Record<string, unknown> = {};
  const previousValues: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(patch)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    // Record previous value for audit
    previousValues[key] = (user as unknown as Record<string, unknown>)[key];
    safePatch[key] = value;
  }

  if (Object.keys(safePatch).length === 0) {
    return res.status(400).json({ ok: false, error: 'No valid fields to update' });
  }

  // Apply the patch
  const updated = await updateUser(userId, safePatch as Parameters<typeof updateUser>[1]);
  if (!updated) return res.status(500).json({ ok: false, error: 'Update failed' });

  // Audit log — records before/after for every changed field
  appendAudit({
    event:   'admin_client_edit',
    adminId: session.adminId,
    userId,
    email:   user.email,
    ip:      req.ip ?? 'unknown',
    meta: {
      fields:   Object.keys(safePatch),
      previous: previousValues,
      updated:  safePatch,
    },
  });

  return res.json({ ok: true, user: updated });
}
