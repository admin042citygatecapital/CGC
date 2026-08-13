import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  getSecret: vi.fn(),
  getSponsorReadiness: vi.fn(),
}));

vi.mock('../../server/lib/runtimeSecrets.js', () => ({ getSecret: dependencies.getSecret }));
vi.mock('../../server/lib/sponsorReadinessStore.js', () => ({ getSponsorReadiness: dependencies.getSponsorReadiness }));
vi.mock('../../server/lib/sponsorReadinessHttp.js', () => ({
  sponsorActor: () => ({ id: 'admin-1', email: 'admin@example.test', role: 'SUPER_ADMIN' }),
  sponsorError: vi.fn(),
}));

import handler from '../../server/api/admin/sponsor-readiness/GET.js';

function response() {
  const res = { json: vi.fn() };
  res.json.mockReturnValue(res);
  return res;
}

describe('sponsor readiness reviewer status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getSponsorReadiness.mockResolvedValue({ summary: { outstanding: 38 }, financialOperationsLocked: true });
  });

  it('reports the review channel unavailable without exposing secret values', async () => {
    dependencies.getSecret.mockReturnValue(null);
    const res = response();
    await handler({} as never, res as never);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      independentReviewer: { configured: false, emailConfigured: false, identityIndependent: false, credentialHashConfigured: false },
      financialOperationsLocked: true,
    }));
  });

  it('requires both a checker identity and a valid SHA-256 credential hash', async () => {
    dependencies.getSecret.mockImplementation((name: string) => name === 'SPONSOR_REVIEWER_EMAIL' ? 'checker@example.test' : name === 'SPONSOR_REVIEWER_KEY_HASH' ? 'a'.repeat(64) : null);
    const res = response();
    await handler({} as never, res as never);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      independentReviewer: { configured: true, emailConfigured: true, identityIndependent: true, credentialHashConfigured: true },
    }));
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('checker@example.test');
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('a'.repeat(64));
  });

  it('does not report the super-administrator as an independent reviewer', async () => {
    dependencies.getSecret.mockImplementation((name: string) => name === 'SPONSOR_REVIEWER_EMAIL' || name === 'ADMIN_EMAIL' ? 'admin@citygate.capital' : name === 'SPONSOR_REVIEWER_KEY_HASH' ? 'a'.repeat(64) : null);
    const res = response();
    await handler({} as never, res as never);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      independentReviewer: { configured: false, emailConfigured: true, identityIndependent: false, credentialHashConfigured: true },
    }));
  });
});
