import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  default: { mkdirSync: vi.fn(), writeFileSync: vi.fn(), unlinkSync: vi.fn() },
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => true,
  testConnection: () => Promise.resolve({ ok: true, latencyMs: 3 }),
}));

vi.mock('../../server/lib/storagePaths.js', () => ({
  privateDataRoot: 'C:/private/runtime/data',
  mediaAssetRoot: 'C:/private/runtime/media',
}));

describe('public health privacy boundary', () => {
  it('returns logical storage labels without internal filesystem paths', async () => {
    const handler = (await import('../../server/api/health/GET.js')).default;
    const state: { status: number; body?: Record<string, unknown> } = { status: 200 };
    const response = {
      status(code: number) { state.status = code; return response; },
      json(body: Record<string, unknown>) { state.body = body; return response; },
    } as unknown as Response;

    await handler({} as Request, response);

    expect(state.status).toBe(200);
    expect(state.body).toMatchObject({ status: 'ok' });
    expect(Object.keys(state.body?.storage as Record<string, string>)).toEqual([
      'customers', 'administration', 'contacts', 'accounts', 'media',
    ]);
    expect(JSON.stringify(state.body)).not.toMatch(/C:\/private|runtime\/data|runtime\/media/i);
  });
});
