import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  secrets: new Map<string, string>(),
  testConnection: vi.fn(),
}));

vi.mock('#runtime/secrets', () => ({
  getSecret: (name: string) => dependencies.secrets.get(name),
}));
vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => true,
  testConnection: dependencies.testConnection,
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
    });
  });

  it('reports a database failure as a platform alert', async () => {
    dependencies.testConnection.mockResolvedValue({ ok: false, latencyMs: 4, error: 'unavailable' });
    const handler = (await import('../../server/api/admin/health/GET.js')).default;
    const { state, res } = response();
    await handler({} as Request, res);

    expect(state.body).toMatchObject({ status: 'error', checks: { database: 'FAIL', email: 'WARN' } });
  });
});
