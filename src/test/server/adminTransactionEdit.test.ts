import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const appendAudit = vi.fn();
vi.mock('../../server/lib/auditLog.js', () => ({ appendAudit }));

let root = '';

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-admin-tx-edit-'));
  process.env.PRIVATE_DATA_ROOT = root;
  delete process.env.DATABASE_URL;
  vi.resetModules();
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.PRIVATE_DATA_ROOT;
});

function response() {
  const state: { status: number; body?: any } = { status: 200 };
  const res = {
    status(code: number) { state.status = code; return res; },
    json(body: unknown) { state.body = body; return res; },
  } as unknown as Response;
  return { res, state };
}

function request(body: Record<string, unknown>) {
  return {
    body,
    ip: '127.0.0.1',
    adminSession: { adminId: 'super-admin-test', email: 'admin@example.test', role: 'SUPER_ADMIN' },
  } as unknown as Request;
}

describe('super-administrator transaction metadata correction', () => {
  it('corrects only allowed metadata and records immutable before/after evidence', async () => {
    const store = await import('../../server/lib/transactionStore.js');
    const created = await store.createTransaction({
      type: 'transfer',
      status: 'completed',
      userId: 'customer-1',
      userName: 'Test Customer',
      userEmail: 'customer@example.test',
      amount: 125.5,
      currency: 'GBP',
      description: 'Original description',
    });
    const handler = (await import('../../server/api/admin/transactions/edit/POST.js')).default;
    const result = response();

    await handler(request({
      txId: created.id,
      description: 'Corrected description',
      adminNote: 'Reviewed against the customer support record.',
      flagged: true,
      reason: 'Correcting descriptive metadata after documented review.',
    }), result.res);

    expect(result.state.status).toBe(200);
    expect(result.state.body.transaction).toMatchObject({
      description: 'Corrected description',
      adminNote: 'Reviewed against the customer support record.',
      flagged: true,
      amount: 125.5,
      currency: 'GBP',
      status: 'completed',
      userId: 'customer-1',
      reference: created.reference,
      createdAt: created.createdAt,
    });
    expect(appendAudit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'transaction_metadata_corrected',
      adminId: 'super-admin-test',
      reason: 'Correcting descriptive metadata after documented review.',
      meta: expect.objectContaining({
        before: expect.objectContaining({ description: 'Original description', flagged: false }),
        after: expect.objectContaining({ description: 'Corrected description', flagged: true }),
      }),
    }));
  });

  it('rejects attempts to rewrite financial or identity fields', async () => {
    const store = await import('../../server/lib/transactionStore.js');
    const created = await store.createTransaction({
      type: 'fee', status: 'pending', userId: 'customer-2', userName: 'Second Customer',
      userEmail: 'second@example.test', amount: 10, currency: 'USD', description: 'Service fee',
    });
    const handler = (await import('../../server/api/admin/transactions/edit/POST.js')).default;
    const result = response();
    await handler(request({ txId: created.id, amount: 999999, currency: 'EUR', description: 'Tampered', reason: 'Attempting a forbidden monetary rewrite.' }), result.res);

    expect(result.state.status).toBe(400);
    expect(result.state.body.code).toBe('IMMUTABLE_TRANSACTION_FIELDS');
    expect(result.state.body.fields).toEqual(expect.arrayContaining(['amount', 'currency']));
    expect(await store.findTransactionById(created.id)).toMatchObject({ amount: 10, currency: 'USD', description: 'Service fee' });
  });

  it('requires a meaningful audit reason', async () => {
    const store = await import('../../server/lib/transactionStore.js');
    const created = await store.createTransaction({
      type: 'refund', status: 'pending', userId: 'customer-3', userName: 'Third Customer',
      userEmail: 'third@example.test', amount: 20, currency: 'USD', description: 'Refund',
    });
    const handler = (await import('../../server/api/admin/transactions/edit/POST.js')).default;
    const result = response();
    await handler(request({ txId: created.id, description: 'New refund label', reason: 'short' }), result.res);
    expect(result.state.status).toBe(400);
    expect(await store.findTransactionById(created.id)).toMatchObject({ description: 'Refund' });
  });
});
