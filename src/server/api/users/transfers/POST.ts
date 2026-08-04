/**
 * POST /api/users/transfers
 * Identical behavior to POST /api/users/transfer — see customerTransfer.ts.
 * Both routes are expected by src/server/entry.ts; kept as two thin
 * wrappers around the same shared logic rather than picking one to be
 * "the real one" and leaving the other unresolved.
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { createCustomerTransfer } from '../../../lib/customerTransfer.js';
import { appendAudit } from '../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = await findUserBySessionToken(token);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const result = await createCustomerTransfer(user, req.body as Record<string, unknown>);
  if (!result.ok) return res.status(result.status).json({ ok: false, error: result.error });

  appendAudit({ event: 'user_transfer_requested', userId: user.id, email: user.email, ip: req.ip ?? 'unknown', meta: { txId: result.transaction.id } });

  return res.status(201).json({ ok: true, transaction: result.transaction, fee: result.fee, message: 'Transfer submitted — awaiting approval.' });
}
