import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  secrets: new Map<string, string>(),
  testConnection: vi.fn(),
  query: vi.fn(),
  envReport: {
    summary: { total: 2, present: 0, defaults: 0, missing: 2, critical: 0, warnings: 2 },
    variables: [
      { service: 'Independent Sponsor Review', status: 'MISSING' },
      { service: 'Independent Sponsor Review', status: 'MISSING' },
    ],
  },
}));

vi.mock('#runtime/secrets', () => ({
  getSecret: (name: string) => dependencies.secrets.get(name),
}));
vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => true,
  testConnection: dependencies.testConnection,
  getQueryClient: () => dependencies.query,
}));
vi.mock('../../server/lib/envValidator.js', () => ({
  buildEnvReport: () => dependencies.envReport,
}));

function response() {
  const state: { status: number; body?: Record<string, unknown> } = { status: 200 };
  const res = {
    status(code: number) { state.status = code; return res; },
    json(body: Record<string, unknown>) { state.body = body; return res; },
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
    dependencies.envReport.summary.critical = 0;
  });

  it('uses PostgreSQL and the configured primary email provider as health evidence', async () => {
    dependencies.secrets.set('RESEND_API_KEY', 're_test_key');
    const handler = (await import('../../server/api/admin/health/GET.js')).default;
    const { state, res } = response();
    await handler({} as Request, res);

    expect(state.body).toMatchObject({
      status: 'healthy',
      components: {
        database: { state: 'healthy', required: true },
        email: { state: 'healthy', required: false },
        sessions: { state: 'healthy', required: true },
      },
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

    expect(state.body).toMatchObject({ status: 'degraded', checks: { database: 'FAIL', email: 'WARN' } });
    expect(dependencies.query).not.toHaveBeenCalled();
  });

  it('fails the database summary check instead of reporting stale local files', async () => {
    dependencies.query.mockRejectedValue(new Error('summary unavailable'));
    const handler = (await import('../../server/api/admin/health/GET.js')).default;
    const { state, res } = response();
    await handler({} as Request, res);

    expect(state.body).toMatchObject({
      status: 'degraded',
      database: { ok: true, summaryAvailable: false },
      checks: { database: 'FAIL', storage: 'FAIL' },
      users: { total: 0 },
    });
  });

  it('does not degrade the application when optional email is intentionally not configured', async () => {
    const handler = (await import('../../server/api/admin/health/GET.js')).default;
    const { state, res } = response();
    await handler({} as Request, res);

    const [queryParts] = dependencies.query.mock.calls[0] as [TemplateStringsArray];
    const summarySql = Array.from(queryParts).join(' ');
    expect(summarySql).toContain('(SELECT max(updated_at) FROM homepage_content_versions)');
    expect(summarySql).not.toContain('(SELECT max(created_at) FROM homepage_content_versions)');

    expect(state.body).toMatchObject({
      status: 'healthy',
      components: { email: { state: 'not_configured', required: false } },
      checks: { email: 'WARN', database: 'PASS', sessions: 'PASS' },
    });
  });

  it('keeps missing optional sponsor-review settings separate from required configuration', async () => {
    const handler = (await import('../../server/api/admin/health/GET.js')).default;
    const { state, res } = response();
    await handler({} as Request, res);

    expect(state.body).toMatchObject({
      status: 'healthy',
      components: {
        configuration: { state: 'healthy', required: true },
        sponsorReview: { state: 'not_configured', required: false },
        memory: { state: 'healthy', required: true },
      },
      configuration: {
        coreValid: true,
        sponsorReview: 'not_configured',
      },
    });
    const memory = state.body?.memory as { heapLimitMb: number; heapUsedMb: number };
    expect(memory.heapLimitMb).toBeGreaterThan(memory.heapUsedMb);
  });

  it('fails closed when required protected configuration is invalid', async () => {
    dependencies.envReport.summary.critical = 1;
    const handler = (await import('../../server/api/admin/health/GET.js')).default;
    const { state, res } = response();
    await handler({} as Request, res);

    expect(state.body).toMatchObject({
      status: 'degraded',
      components: { configuration: { state: 'degraded', required: true } },
      configuration: { coreValid: false, criticalIssues: 1 },
    });
  });
});
