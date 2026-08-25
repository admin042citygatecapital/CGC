// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  buildTransactionReceiptView,
  generateTransactionReceiptPdf,
} from '../../server/lib/transactionReceipt.js';
import type { Transaction } from '../../server/lib/transactionStore.js';

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx_receipt_test',
    type: 'transfer',
    status: 'completed',
    userId: 'customer_owner',
    userName: 'Private Customer',
    userEmail: 'private.customer@example.test',
    amount: 1250.45,
    currency: 'USD',
    reference: 'CGCRECEIPT001',
    description: 'Transfer to savings',
    walletAddress: '0xPRIVATE-WALLET-ADDRESS',
    txHash: 'PRIVATE-BLOCKCHAIN-HASH',
    bankName: 'Private Bank',
    accountNumber: '1234567890',
    routingNumber: '010203040',
    swiftCode: 'PRIVATEBIC',
    adminNote: 'Internal investigation note',
    note: 'Private customer note',
    ip: '192.0.2.12',
    flagged: false,
    createdAt: '2026-08-25T14:15:16.000Z',
    updatedAt: '2026-08-25T14:15:16.000Z',
    ...overrides,
  };
}

describe('transaction receipt PDF', () => {
  it('creates a valid branded PDF carrying the canonical reference and exact status', async () => {
    const pdfBytes = await generateTransactionReceiptPdf(transaction());
    expect(pdfBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    const pdf = await PDFDocument.load(pdfBytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toContain('CGCRECEIPT001');
    expect(pdf.getSubject()).toBe('Transfer | Completed | CGCRECEIPT001');
    expect(pdf.getKeywords()).toContain('CGCRECEIPT001');
    // The approved PNG is embedded as an image XObject, rather than replaced
    // with unapproved text-only branding.
    expect(pdfBytes.toString('latin1')).toContain('/Subtype /Image');
  });

  it('whitelists only receipt-safe fields and omits sensitive identifiers', async () => {
    const source = transaction();
    const view = buildTransactionReceiptView(source);
    expect(view).toEqual({
      reference: 'CGCRECEIPT001',
      type: 'Transfer',
      status: 'Completed',
      occurredAt: '25 August 2026 at 14:15:16 UTC',
      amount: 'USD\u00a01,250.45',
      currency: 'USD',
      description: 'Transfer to savings',
    });
    const serialized = JSON.stringify(view);
    for (const secret of [
      source.userEmail,
      source.walletAddress,
      source.txHash,
      source.accountNumber,
      source.routingNumber,
      source.swiftCode,
      source.adminNote,
      source.note,
      source.ip,
    ]) expect(serialized).not.toContain(secret);

    const pdfBytes = await generateTransactionReceiptPdf(source);
    const rawPdf = pdfBytes.toString('latin1');
    for (const secret of ['private.customer@example.test', '0xPRIVATE-WALLET-ADDRESS', '1234567890', 'Internal investigation note']) {
      expect(rawPdf).not.toContain(secret);
    }
  });

  it.each([
    ['pending', 'Pending'],
    ['failed', 'Failed'],
    ['rejected', 'Rejected'],
    ['flagged', 'Under review'],
    ['frozen', 'Restricted'],
  ] as const)('preserves persisted status %s as %s', async (status, label) => {
    const source = transaction({ status });
    expect(buildTransactionReceiptView(source).status).toBe(label);
    const pdf = await PDFDocument.load(await generateTransactionReceiptPdf(source));
    expect(pdf.getSubject()).toContain(`| ${label} |`);
  });

  it('does not manufacture a fee when the canonical record has no fee field', () => {
    const view = buildTransactionReceiptView(transaction());
    expect(view).not.toHaveProperty('fee');
    expect(JSON.stringify(view).toLowerCase()).not.toContain('fee');
  });
});
