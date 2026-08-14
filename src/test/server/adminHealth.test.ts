import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  secrets: new Map<string, string>(),
  testConnection: vi.fn(),
  query: vi.fn(),
}));

vi.mock('#runtime/secrets', () => ({
  getSecret: (name: string) => dependencies.secrets.get(name),
}));
vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => true,
  testConnection: dependencies.testConnection,
  getQueryClient: () => dependencies.query,
}));

function response() {
  const state: { status: number; body?: Record<string, any> } = { status: 200 };
  const res = {
    status(code: number) { state.status = code; return res; },
    json(body: Record<string, any>) { state.body = body; return res; },
  } as unknown as Response;
  return { state, res };
}

describe('admin platform health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.secrets.clear();
    dependencies.testConnection.mockResolvedValue({ ok: true, latencyMs: 2 });
    dependencies.query.mockResolvedValue([{
      usersTotal: 12, usersVerified: 9, usersPendingKyc: 2, usersSuspended: 1,
      activeAdminSessions: 1, activeCustomerSessions: 3, operationsTotal: 8,
      contactSubmissions: 4, accountApplications: 2, newsletterSubscribers: 6,
      homepageVersions: 3, mediaAssets: 5, operationsUpdatedAt: null,
      homepageUpdatedAt: null, mediaUpdatedAt: null,
    }]);
  });

  it('uses PostgreSQL and the configured primary email provider as health evidence', async () => {
    dependencies.secrets.set('RESEND_API_KEY', 're_test_key');
    const handler = (await import('../../server/api/admin/health/GET.js')).default;
    const { state, res } = response();
    await handler({} as Request, res);

    expect(state.body).toMatchObject({
      status: 'ok',
      database: { ok: true, provider: 'postgresql' },
      email: { configured: true, provider: 'Resend' },
      checks: { api: 'PASS', database: 'PASS', email: 'PASS' },
      runtime: { activeSessions: 4, activeAdminSessions: 1, activeCustomerSessions: 3 },
      users: { total: 12, verified: 9, pending: 2, suspended: 1 },
      storage: { database: 'managed', trackedRecords: 34 },
    });
  });

  it('reports a database failure as a platform alert', async () => {
    dependencies.testConnection.mockResolvedValue({ ok: false, latencyMs: 4, error: 'unavailable' });
    const handler = (await import('../../server/api/admin/health/GET.js')).default;
    const { state, res } = response();
    await handler({} as Request, res);

    expect(state.body).toMatchObject({ status: 'error', checks: { database: 'FAIL', email: 'WARN' } });
    expect(dependencies.query).not.toHaveBeenCalled();
  });

  it('fails the database summary check instead of reporting stale local files', async () => {
    dependencies.query.mockRejectedValue(new Error('summary unavailable'));
    const handler = (await import('../../server/api/admin/health/GET.js')).default;
    const { state, res } = response();
    await handler({} as Request, res);

    expect(state.body).toMatchObject({
      status: 'error',
      database: { ok: true, summaryAvailable: false },
      checks: { database: 'FAIL', storage: 'FAIL' },
      users: { total: 0 },
    });
  });
});
