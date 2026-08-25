import fs from 'node:fs/promises';
import path from 'node:path';
import {
  generateTransactionReceiptPdf,
  type TransactionReceiptOptions,
} from '../src/server/lib/transactionReceipt.js';
import type { Transaction } from '../src/server/lib/transactionStore.js';

const now = new Date();
const previewTransaction: Transaction = {
  id: 'tx_receipt_preview',
  type: 'transfer',
  status: 'completed',
  userId: 'preview_customer',
  userName: 'Receipt Preview',
  userEmail: 'preview@example.invalid',
  amount: 1250,
  currency: 'USD',
  reference: `CGCPREVIEW${now.toISOString().slice(0, 10).replace(/-/g, '')}`,
  description: 'International transfer',
  walletAddress: '0xTHIS_VALUE_MUST_NEVER_APPEAR_IN_THE_RECEIPT',
  accountNumber: '9876543210',
  routingNumber: '000111222',
  swiftCode: 'CGCPREVIEW',
  adminNote: 'This internal note must never appear in the receipt.',
  flagged: false,
  ip: '192.0.2.10',
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};

const outputDirectory = path.resolve(process.cwd(), 'artifacts');
const outputPath = path.join(outputDirectory, 'City_Gate_Capital_Transaction_Receipt_Preview.pdf');
const options: TransactionReceiptOptions = { preview: true };
await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(outputPath, await generateTransactionReceiptPdf(previewTransaction, options));
process.stdout.write(`${outputPath}\n`);
