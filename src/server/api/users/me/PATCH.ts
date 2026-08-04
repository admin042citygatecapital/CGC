/**
 * PATCH /api/users/me
 * Customer self-service profile update.
 * Allows updating: name, phone, country, bankName, bankAccountNumber,
 * bankRoutingNumber, bankSwift, bankIban, walletBtc, walletEth, walletUsdt.
 * Password changes require current password confirmation.
 *
 * Reworked against the current backend: password verification/hashing goes
 * through passwordHash.ts (Argon2id, with transparent legacy-hash upgrade)
 * instead of bcryptjs, and session rotation on password change goes through
 * customerSessionStore (deleteAllCustomerSessions + createCustomerSession)
 * instead of a bare `sessionToken`/`sessionTokenExpiry` patch — the latter
 * field doesn't exist on UserRecord and was silently dropped by updateUser's
 * field-mapping in DB-backed mode.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken, updateUser } from '../../../lib/userStore.js';
import { deleteAllCustomerSessions, createCustomerSession } from '../../../lib/customerSessionStore.js';
import { verifyPassword, hashPassword } from '../../../lib/passwordHash.js';
import { appendAudit } from '../../../lib/auditLog.js';
import { sanitizeString } from '../../../lib/inputValidator.js';

const ALLOWED_FIELDS = new Set([
  'name', 'phone', 'country',
  'bankName', 'bankAccountNumber', 'bankRoutingNumber', 'bankSwift', 'bankIban',
  'walletBtc', 'walletEth', 'walletUsdt',
]);

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { patch, currentPassword, newPassword } = req.body as {
    patch?: Record<string, unknown>;
    currentPassword?: string;
    newPassword?: string;
  };

  const safePatch: Record<string, unknown> = {};

  // Handle profile field updates
  if (patch && typeof patch === 'object') {
    for (const [key, value] of Object.entries(patch)) {
      if (!ALLOWED_FIELDS.has(key)) continue;
      safePatch[key] = typeof value === 'string' ? sanitizeString(value) : value;
    }
  }

  let newSessionToken: string | undefined;

  // Handle password change
  if (newPassword !== undefined) {
    if (!currentPassword) {
      return res.status(400).json({ ok: false, error: 'Current password is required to set a new password' });
    }
    const { ok: passwordOk } = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordOk) {
      return res.status(403).json({ ok: false, error: 'Current password is incorrect' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: 'New password must be at least 8 characters' });
    }
    safePatch['passwordHash'] = await hashPassword(newPassword);

    // Rotate session so other devices are logged out
    await deleteAllCustomerSessions(user.id);
    newSessionToken = await createCustomerSession(user.id, { ip: req.ip, ua: String(req.headers['user-agent'] ?? '') });
    safePatch['sessionToken'] = newSessionToken;
  }

  if (Object.keys(safePatch).length === 0) {
    return res.status(400).json({ ok: false, error: 'No valid fields to update' });
  }

  const updated = await updateUser(user.id, safePatch as Parameters<typeof updateUser>[1]);
  if (!updated) return res.status(500).json({ ok: false, error: 'Update failed' });

  appendAudit({
    event: 'user_profile_update',
    userId: user.id,
    email: user.email,
    ip: req.ip ?? 'unknown',
    meta: { fields: Object.keys(safePatch).filter(k => k !== 'passwordHash') },
  });

  return res.json({
    ok: true,
    user: {
      id:        updated.id,
      name:      updated.name,
      email:     updated.email,
      status:    updated.status,
      kycStatus: updated.kycStatus,
      balance:   updated.balance ?? 0,
      // Return new session token if password was changed
      ...(newSessionToken ? { sessionToken: newSessionToken } : {}),
    },
  });
}
