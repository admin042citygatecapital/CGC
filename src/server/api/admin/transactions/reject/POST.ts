/**
 * POST /api/admin/transactions/reject
 * Reject a pending transaction.
 * Body: { txId, reason }
 */
import type { Request, Response } from 'express';
import { findTransactionById, updateTransaction } from '../../../../lib/transactionStore.js';
import { appendAudit, appendCriticalAudit } from '../../../../lib/auditLog.js';
import { authorizeRecentAdminStepUp } from '../../../../lib/rbacMiddleware.js';
import { sanitizeNote } from '../../../../lib/inputValidator.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const txId = req.body?.txId ?? req.body?.transactionId;
  const reason = sanitizeNote(req.body?.reason ?? '');

  if (!txId)   return res.status(400).json({ success: false, error: 'txId is required' });
  if (reason.length < 10) return res.status(400).json({ success: false, error: 'A rejection reason of at least 10 characters is required.' });
  if (!authorizeRecentAdminStepUp(req, res)) return;

  const tx = await findTransactionById(txId);
  if (!tx) return res.status(404).json({ success: false, error: 'Transaction not found' });
  if (tx.status !== 'pending') {
    return res.status(400).json({ success: false, error: `Cannot reject a transaction with status: ${tx.status}` });
  }

  await appendCriticalAudit({
    event: 'transaction_rejection_intent', adminId: session.adminId, userId: tx.userId,
    email: tx.userEmail, ip: req.ip ?? 'unknown', reason: String(reason).slice(0, 500),
    meta: { txId, amount: tx.amount, currency: tx.currency, reference: tx.reference },
  });

  const updated = await updateTransaction(txId, {
    status:           'rejected',
    rejectedBy:       session.adminId,
    rejectedAt:       new Date().toISOString(),
    rejectionReason:  String(reason).slice(0, 500),
  });

  appendAudit({
    event:   'transaction_rejected',
    adminId: session.adminId,
    userId:  tx.userId,
    email:   tx.userEmail,
    ip:      req.ip ?? 'unknown',
    meta:    { txId, amount: tx.amount, currency: tx.currency, reference: tx.reference, reason },
  });

  return res.json({ success: true, transaction: updated });
}
