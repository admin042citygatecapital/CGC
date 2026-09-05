import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { isOutsideSandboxKycScope, LIVE_FINANCIAL_ACTIVITY_IN_SCOPE, SUMSUB_VERIFICATION_SCOPE } from '../../shared/productScope.js';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('sandbox KYC product scope', () => {
  it('declares sandbox identity verification without live finance', () => {
    expect(SUMSUB_VERIFICATION_SCOPE).toBe('sandbox_kyc_only');
    expect(LIVE_FINANCIAL_ACTIVITY_IN_SCOPE).toBe(false);
  });
  it.each(['/admin/trading', '/admin/trading/orders', '/admin/transfers', '/admin/cards', '/admin/crypto', '/admin/accounts', '/dashboard', '/dashboard/exchange', '/dashboard/trading/chart', '/wallet', '/plaid/oauth'])('excludes financial route %s', path => {
    expect(isOutsideSandboxKycScope(path)).toBe(true);
  });
  it.each(['/admin', '/admin/onboarding', '/admin/integrations', '/admin/security', '/admin/audit', '/onboarding', '/kyc', '/dashboard/security', '/dashboard/support', '/login'])('preserves non-financial route %s', path => {
    expect(isOutsideSandboxKycScope(path)).toBe(false);
  });
  it('keeps finance and paper trading blocked even with operational switches enabled', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PLATFORM_MODE', 'live');
    vi.stubEnv('ENABLE_FINANCIAL_OPERATIONS', '1');
    vi.stubEnv('ENABLE_PAPER_TRADING', '1');
    const policy = await import('../../server/lib/platformMode.js');
    for (const name of policy.LIVE_READINESS_ENV) vi.stubEnv(name, 'test-attestation');
    for (const name of policy.LIVE_READINESS_FLAGS) vi.stubEnv(name, '1');
    expect(policy.getLiveFinancialReadinessGaps()).toContain('Live financial activity is outside the sandbox KYC product scope');
    expect(policy.hasLiveFinancialReadiness()).toBe(false);
    for (const guard of [policy.requireFinancialOperations, policy.requireCardOperations, policy.requirePaperTrading]) {
      const json = vi.fn();
      const status = vi.fn(() => ({ json }));
      expect(guard({ status } as unknown as Response)).toBe(false);
      expect(status).toHaveBeenCalledWith(503);
    }
  });
});
