/**
 * POST /api/admin/transactions/freeze
 * Freeze a suspicious transaction.
 * Body: { txId, reason }
 */
import type { Request, Response } from 'express';
import { findTransactionById, updateTransaction } from '../../../../lib/transactionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { txId, reason = '' } = req.body ?? {};

  if (!txId) return res.status(400).json({ success: false, error: 'txId is required' });

  const tx = await findTransactionById(txId);
  if (!tx) return res.status(404).json({ success: false, error: 'Transaction not found' });

  const updated = await updateTransaction(txId, {
    status:    'frozen',
    flagged:   true,
    frozenBy:  session.adminId,
    frozenAt:  new Date().toISOString(),
    adminNote: String(reason).slice(0, 500),
  });

  appendAudit({
    event:   'transaction_frozen',
    adminId: session.adminId,
    userId:  tx.userId,
    email:   tx.userEmail,
    ip:      req.ip ?? 'unknown',
    meta:    { txId, amount: tx.amount, currency: tx.currency, reference: tx.reference, reason },
  });

  return res.json({ success: true, transaction: updated });
}
