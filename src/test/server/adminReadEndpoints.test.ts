import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let root = '';
let originalDatabaseUrl: string | undefined;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-admin-read-'));
  originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.PRIVATE_DATA_ROOT = root;
  vi.resetModules();
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.PRIVATE_DATA_ROOT;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

function response() {
  const state: { status: number; body?: any } = { status: 200 };
  const res = {
    status(code: number) { state.status = code; return res; },
    json(body: unknown) { state.body = body; return res; },
  } as unknown as Response;
  return { res, state };
}

describe('admin read endpoint contracts', () => {
  it('filters and paginates persisted login events', async () => {
    const loginLog = await import('../../server/lib/loginLog.js');
    await loginLog.appendLoginEvent('admin', 'security@example.test', 'success', '127.0.0.1', 'Mozilla/5.0 Chrome/120');
    await loginLog.appendLoginEvent('user', 'customer@example.test', 'failed', '192.0.2.10', 'Mozilla/5.0 Firefox/120', { reason: 'bad password' });

    const handler = (await import('../../server/api/admin/security/logs/GET.js')).default;
    const result = response();
    await handler({ query: { type: 'login', result: 'failed', search: 'customer', limit: '1', offset: '0' } } as unknown as Request, result.res);

    expect(result.state.status).toBe(200);
    expect(result.state.body).toMatchObject({ total: 1, limit: 1, offset: 0, dataClassification: 'persisted_login_events' });
    expect(result.state.body.data).toHaveLength(1);
    expect(result.state.body.data[0]).toMatchObject({ email: 'customer@example.test', result: 'failed' });
  });

  it('returns deferred trading administration logs with category filtering', async () => {
    const store = await import('../../server/lib/tradingAdminStore.js');
    store.appendTradingLog({ action: 'market_disabled', category: 'market', details: 'Disabled for readiness', adminId: 'admin-1', adminEmail: 'admin@example.test' });
    store.appendTradingLog({ action: 'fee_updated', category: 'fee', details: 'Planning record only', adminId: 'admin-1', adminEmail: 'admin@example.test' });

    const handler = (await import('../../server/api/admin/trading/logs/GET.js')).default;
    const result = response();
    handler({ query: { category: 'market' } } as unknown as Request, result.res);

    expect(result.state.status).toBe(200);
    expect(result.state.body).toMatchObject({ total: 1, dataClassification: 'deferred_trading_admin_audit' });
    expect(result.state.body.logs).toHaveLength(1);
    expect(result.state.body.logs[0]).toMatchObject({ category: 'market', action: 'market_disabled' });
  });

  it('returns a least-privilege customer support profile', async () => {
    const users = await import('../../server/lib/userStore.js');
    const user = await users.createUser({
      email: 'support-profile@example.test',
      name: 'Support Profile',
      status: 'active',
      kycStatus: 'approved',
      emailVerified: true,
      passwordHash: 'must-not-leak',
      bankAccountNumber: 'must-not-leak',
      idDocumentUrl: 'must-not-leak',
      sessionToken: 'must-not-leak',
      accountTier: 'business',
    });

    const handler = (await import('../../server/api/admin/users/[id]/GET.js')).default;
    const result = response();
    await handler({ params: { id: user.id } } as unknown as Request, result.res);

    expect(result.state.status).toBe(200);
    expect(result.state.body).toMatchObject({
      id: user.id,
      email: 'support-profile@example.test',
      accountTier: 'business',
      dataClassification: 'customer_support_profile',
    });
    expect(result.state.body).not.toHaveProperty('passwordHash');
    expect(result.state.body).not.toHaveProperty('bankAccountNumber');
    expect(result.state.body).not.toHaveProperty('idDocumentUrl');
    expect(result.state.body).not.toHaveProperty('sessionToken');
  });

  it('rejects invalid filters and unknown users', async () => {
    const securityHandler = (await import('../../server/api/admin/security/logs/GET.js')).default;
    const invalid = response();
    await securityHandler({ query: { actor: 'anyone' } } as unknown as Request, invalid.res);
    expect(invalid.state.status).toBe(400);

    const userHandler = (await import('../../server/api/admin/users/[id]/GET.js')).default;
    const missing = response();
    await userHandler({ params: { id: 'missing-user' } } as unknown as Request, missing.res);
    expect(missing.state.status).toBe(404);
  });
});
