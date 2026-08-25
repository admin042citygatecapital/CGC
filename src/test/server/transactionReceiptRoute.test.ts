// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const findTransactionById = vi.fn();
const generateTransactionReceiptPdf = vi.fn();
const transactionReceiptFilename = vi.fn(() => 'City-Gate-Capital-CGCRECEIPT001-receipt.pdf');

vi.mock('../../server/lib/transactionStore.js', () => ({ findTransactionById }));
vi.mock('../../server/lib/transactionReceipt.js', () => ({
  generateTransactionReceiptPdf,
  transactionReceiptFilename,
}));

function response() {
  const headers = new Map<string, string>();
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn((name: string, value: string) => headers.set(name, value)),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);
  return { res: res as unknown as Response, raw: res, headers };
}

function request(customerId?: string, transactionId = 'tx_receipt_test') {
  return {
    query: { transactionId },
    customerUser: customerId ? { id: customerId } : undefined,
  } as unknown as Request;
}

describe('customer transaction receipt route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateTransactionReceiptPdf.mockResolvedValue(Buffer.from('%PDF-receipt'));
  });

  it('requires an authenticated customer', async () => {
    const { default: handler } = await import('../../server/api/users/transactions/receipt/GET.js');
    const { res, raw } = response();
    await handler(request(), res);
    expect(raw.status).toHaveBeenCalledWith(401);
    expect(findTransactionById).not.toHaveBeenCalled();
  });

  it('returns not found for a transaction owned by another customer', async () => {
    const { default: handler } = await import('../../server/api/users/transactions/receipt/GET.js');
    findTransactionById.mockResolvedValue({ id: 'tx_receipt_test', userId: 'customer_other' });
    const { res, raw } = response();
    await handler(request('customer_owner'), res);
    expect(raw.status).toHaveBeenCalledWith(404);
    expect(generateTransactionReceiptPdf).not.toHaveBeenCalled();
  });

  it('downloads only the authenticated customer own receipt with private no-store headers', async () => {
    const { default: handler } = await import('../../server/api/users/transactions/receipt/GET.js');
    const owned = { id: 'tx_receipt_test', userId: 'customer_owner', reference: 'CGCRECEIPT001' };
    findTransactionById.mockResolvedValue(owned);
    const { res, raw, headers } = response();
    await handler(request('customer_owner'), res);

    expect(generateTransactionReceiptPdf).toHaveBeenCalledWith(owned);
    expect(raw.status).toHaveBeenCalledWith(200);
    expect(raw.send).toHaveBeenCalledWith(Buffer.from('%PDF-receipt'));
    expect(headers.get('Content-Type')).toBe('application/pdf');
    expect(headers.get('Content-Disposition')).toContain('CGCRECEIPT001');
    expect(headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('rejects malformed transaction identifiers before store access', async () => {
    const { default: handler } = await import('../../server/api/users/transactions/receipt/GET.js');
    const { res, raw } = response();
    await handler(request('customer_owner', '../other-customer'), res);
    expect(raw.status).toHaveBeenCalledWith(400);
    expect(findTransactionById).not.toHaveBeenCalled();
  });
});
