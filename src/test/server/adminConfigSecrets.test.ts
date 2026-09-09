import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => false,
  getDb: () => { throw new Error('Database access prohibited in this test'); },
}));
vi.mock('../../server/lib/auditLog.js', () => ({ appendCriticalAudit: vi.fn() }));
vi.mock('../../server/lib/rbacMiddleware.js', () => ({ authorizeRecentAdminStepUp: () => false }));
vi.mock('../../server/lib/envValidator.js', () => ({ buildEnvReport: () => ({ variables: [] }) }));
vi.mock('../../server/lib/homepageCmsStore.js', () => ({
  readHomepageDocument: async () => ({ content: {} }),
  homepageAdminView: () => ({}),
  defaultHomepageAdminView: () => ({}),
  mergeHomepageAdminView: () => ({}),
  publishHomepageContent: vi.fn(),
}));

const secret = 'unit-test-only-exchange-key';
const mask = '\u2022'.repeat(8);

function response() {
  const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  const store = await import('../../server/lib/configStore.js');
  await store.updateSection('exchangeRates', { apiKey: secret });
});

describe('admin configuration secret boundaries', () => {
  it.each([undefined, 'exchangeRates'])('redacts GET section %s without mutating the stored key', async section => {
    const { default: handler } = await import('../../server/api/admin/config/GET.js');
    const store = await import('../../server/lib/configStore.js');
    const res = response();
    await handler({ query: { section } } as unknown as Request, res as unknown as Response);
    expect(res.json).toHaveBeenCalledOnce();
    const body = res.json.mock.calls[0][0];
    expect(body.exchangeRates.apiKey).toBe(mask);
    expect(JSON.stringify(body)).not.toContain(secret);
    expect(store.getConfig().exchangeRates.apiKey).toBe(secret);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it.each(['constructor', '__proto__'])('rejects inherited section %s', async section => {
    const { default: handler } = await import('../../server/api/admin/config/GET.js');
    const res = response();
    await handler({ query: { section } } as unknown as Request, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it.each(['save', 'reset'])('redacts the full response after a branding %s', async action => {
    const { default: handler } = await import('../../server/api/admin/config/POST.js');
    const store = await import('../../server/lib/configStore.js');
    const res = response();
    await handler({ body: { section: 'branding', action, data: {} } } as unknown as Request, res as unknown as Response);
    const body = res.json.mock.calls[0][0];
    expect(body.ok).toBe(true);
    expect(body.config.exchangeRates.apiKey).toBe(mask);
    expect(JSON.stringify(body)).not.toContain(secret);
    expect(store.getConfig().exchangeRates.apiKey).toBe(secret);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('preserves a key through a masked GET-to-POST round trip', async () => {
    const { default: get } = await import('../../server/api/admin/config/GET.js');
    const { default: post } = await import('../../server/api/admin/config/POST.js');
    const store = await import('../../server/lib/configStore.js');
    const read = response();
    await get({ query: { section: 'exchangeRates' } } as unknown as Request, read as unknown as Response);
    const patch = { ...read.json.mock.calls[0][0].exchangeRates, markupPercent: 2 };
    const saved = response();
    await post({ body: { section: 'exchangeRates', data: patch } } as unknown as Request, saved as unknown as Response);
    expect(saved.json.mock.calls[0][0].ok).toBe(true);
    expect(store.getConfig().exchangeRates.apiKey).toBe(secret);
    expect(store.getConfig().exchangeRates.markupPercent).toBe(2);
    expect(patch.apiKey).toBe(mask);
  });

  it('preserves an omitted key and accepts deliberate replacement or clearing', async () => {
    const store = await import('../../server/lib/configStore.js');
    await store.updateSection('exchangeRates', { markupPercent: 3 });
    expect(store.getConfig().exchangeRates.apiKey).toBe(secret);
    await store.updateSection('exchangeRates', { apiKey: 'unit-test-replacement' });
    expect(store.getConfig().exchangeRates.apiKey).toBe('unit-test-replacement');
    await store.updateSection('exchangeRates', { apiKey: '' });
    expect(store.getConfig().exchangeRates.apiKey).toBe('');
    expect(store.redactConfigSecrets(store.getConfig()).exchangeRates.apiKey).toBe('');
    await store.updateSection('exchangeRates', { apiKey: mask });
    expect(store.getConfig().exchangeRates.apiKey).toBe('');
  });
});
