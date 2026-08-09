/**
 * POST /api/admin/transactions/reject
 * Reject a pending transaction.
 * Body: { txId, reason }
 */
import type { Request, Response } from 'express';
import { findTransactionById, updateTransaction } from '../../../../lib/transactionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const txId = req.body?.txId ?? req.body?.transactionId;
  const reason = req.body?.reason ?? '';

  if (!txId)   return res.status(400).json({ success: false, error: 'txId is required' });
  if (!reason) return res.status(400).json({ success: false, error: 'reason is required' });

  const tx = await findTransactionById(txId);
  if (!tx) return res.status(404).json({ success: false, error: 'Transaction not found' });
  if (tx.status !== 'pending') {
    return res.status(400).json({ success: false, error: `Cannot reject a transaction with status: ${tx.status}` });
  }

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
