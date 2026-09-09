import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  updateSection: vi.fn(),
  resetSection: vi.fn(),
  appendCriticalAudit: vi.fn(),
}));

vi.mock('../../server/lib/configStore.js', () => ({
  updateSection: dependencies.updateSection,
  resetSection: dependencies.resetSection,
  // These fixtures contain no secrets; redaction behavior is tested separately.
  redactConfigSecrets: vi.fn((config: unknown) => config),
}));

vi.mock('../../server/lib/auditLog.js', () => ({
  appendCriticalAudit: dependencies.appendCriticalAudit,
}));

function request(body: Record<string, unknown>): Request {
  return {
    body,
    ip: '127.0.0.1',
    adminSession: { adminId: 'admin_001', email: 'admin@example.test', role: 'SUPER_ADMIN' },
    get: vi.fn(),
  } as unknown as Request;
}

function response(): Response {
  const res = { status: vi.fn(() => res), json: vi.fn(() => res), setHeader: vi.fn(() => res) };
  return res as unknown as Response;
}

describe('admin configuration persistence response', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.updateSection.mockResolvedValue({
      theme: { mode: 'light' },
      exchangeRates: { apiKey: '' },
    });
    dependencies.resetSection.mockResolvedValue({
      theme: { mode: 'dark' },
      exchangeRates: { apiKey: '' },
    });
  });

  it('returns 500 instead of success when the durable update fails', async () => {
    dependencies.updateSection.mockRejectedValueOnce(new Error('persistence unavailable'));
    const handler = (await import('../../server/api/admin/config/POST.js')).default;
    const res = response();

    await handler(request({ section: 'theme', data: { mode: 'light' } }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to save configuration.' });
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns success after the durable update resolves', async () => {
    const handler = (await import('../../server/api/admin/config/POST.js')).default;
    const res = response();

    await handler(request({ section: 'theme', data: { mode: 'light' } }), res);

    expect(dependencies.updateSection).toHaveBeenCalledWith('theme', { mode: 'light' });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('does not send a success response while the durable update is still pending', async () => {
    let resolveWrite!: (value: Record<string, unknown>) => void;
    dependencies.updateSection.mockReturnValueOnce(new Promise(resolve => {
      resolveWrite = resolve;
    }));
    const handler = (await import('../../server/api/admin/config/POST.js')).default;
    const res = response();

    const pendingResponse = handler(request({ section: 'theme', data: { mode: 'light' } }), res);
    await Promise.resolve();

    expect(res.json).not.toHaveBeenCalled();

    resolveWrite({
      theme: { mode: 'light' },
      exchangeRates: { apiKey: '' },
    });
    await pendingResponse;

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 instead of success when a durable reset fails', async () => {
    dependencies.resetSection.mockRejectedValueOnce(new Error('persistence unavailable'));
    const handler = (await import('../../server/api/admin/config/POST.js')).default;
    const res = response();

    await handler(request({ section: 'theme', action: 'reset' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to save configuration.' });
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});
