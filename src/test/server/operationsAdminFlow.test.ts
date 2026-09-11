import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let root = '';

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-admin-flow-'));
  process.env.PRIVATE_DATA_ROOT = root;
  vi.resetModules();
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.PRIVATE_DATA_ROOT;
});

// Submission list and update payloads; item carries the admin notes list the flow asserts on.
type AdminFlowBody = { data?: unknown[]; item?: { adminNotes?: unknown[]; [key: string]: unknown }; [key: string]: unknown };

function response() {
  const state: { status: number; body?: AdminFlowBody } = { status: 200 };
  const res = {
    status(code: number) { state.status = code; return res; },
    json(body: unknown) { state.body = body as AdminFlowBody; return res; },
  } as unknown as Response;
  return { res, state };
}

describe('operations administration acceptance flow', () => {
  it('receives, lists, assigns, notes, and resolves a customer submission', async () => {
    const store = await import('../../server/lib/operationsInboxStore.js');
    const created = await store.createOperationsItem({
      source: 'contact_form', referenceId: 'acceptance-1', title: 'Account help',
      summary: 'Please help with my application', requesterEmail: 'buyer-test@example.test',
    });
    const getHandler = (await import('../../server/api/admin/operations/GET.js')).default;
    const listed = response();
    await getHandler({ query: { search: 'buyer-test' } } as unknown as Request, listed.res);
    expect(listed.state.status).toBe(200);
    expect(listed.state.body?.data).toHaveLength(1);

    const postHandler = (await import('../../server/api/admin/operations/POST.js')).default;
    const updated = response();
    await postHandler({
      body: { id: created.id, status: 'resolved', priority: 'high', assignedTo: 'Operations', note: 'Verified in acceptance test' },
      ip: '127.0.0.1',
      adminSession: { adminId: 'admin-test', email: 'admin@example.test', role: 'SUPER_ADMIN' },
    } as unknown as Request, updated.res);
    expect(updated.state.status).toBe(200);
    expect(updated.state.body?.item).toMatchObject({ status: 'resolved', priority: 'high', assignedTo: 'Operations' });
    expect(updated.state.body?.item?.adminNotes).toHaveLength(1);
  });
});
