/**
 * POST /api/admin/transactions/approve
 * Approve a pending transaction.
 * Body: { txId, note? }
 */
import type { Request, Response } from 'express';
import { findTransactionById, updateTransaction } from '../../../../lib/transactionStore.js';
import { appendAudit } from '../../../../lib/auditLog.js';

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const { txId, note = '' } = req.body ?? {};

  if (!txId) return res.status(400).json({ success: false, error: 'txId is required' });

  const tx = await findTransactionById(txId);
  if (!tx) return res.status(404).json({ success: false, error: 'Transaction not found' });
  if (tx.status !== 'pending') {
    return res.status(400).json({ success: false, error: `Cannot approve a transaction with status: ${tx.status}` });
  }

  const updated = await updateTransaction(txId, {
    status:     'completed',
    approvedBy: session.adminId,
    approvedAt: new Date().toISOString(),
    adminNote:  String(note).slice(0, 500),
  });

  appendAudit({
    event:   'transaction_approved',
    adminId: session.adminId,
    userId:  tx.userId,
    email:   tx.userEmail,
    ip:      req.ip ?? 'unknown',
    meta:    { txId, amount: tx.amount, currency: tx.currency, reference: tx.reference, note },
  });

  return res.json({ success: true, transaction: updated });
}
