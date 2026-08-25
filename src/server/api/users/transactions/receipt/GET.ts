/**
 * GET /api/users/transactions/receipt?transactionId=...
 * Download an authenticated customer's own transaction receipt.
 */
import type { Request, Response } from 'express';
import { findTransactionById } from '../../../../lib/transactionStore.js';
import {
  generateTransactionReceiptPdf,
  transactionReceiptFilename,
} from '../../../../lib/transactionReceipt.js';

const TRANSACTION_ID_PATTERN = /^tx_[A-Za-z0-9_-]{3,100}$/;

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const transactionId = typeof req.query.transactionId === 'string' ? req.query.transactionId.trim() : '';
  if (!TRANSACTION_ID_PATTERN.test(transactionId)) {
    return res.status(400).json({ error: 'A valid transaction identifier is required' });
  }

  const transaction = await findTransactionById(transactionId);
  // Return the same response for absent and cross-customer records so this
  // endpoint cannot be used to discover another customer's transaction IDs.
  if (!transaction || transaction.userId !== user.id) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const receipt = await generateTransactionReceiptPdf(transaction);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${transactionReceiptFilename(transaction)}"`);
  res.setHeader('Content-Length', String(receipt.byteLength));
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(200).send(receipt);
}
