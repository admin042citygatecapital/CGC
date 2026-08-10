import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

const original = {
  NODE_ENV: process.env.NODE_ENV,
  PLATFORM_MODE: process.env.PLATFORM_MODE,
  ENABLE_FINANCIAL_OPERATIONS: process.env.ENABLE_FINANCIAL_OPERATIONS,
  ENABLE_PAPER_TRADING: process.env.ENABLE_PAPER_TRADING,
  ALLOW_PUBLIC_REGISTRATION: process.env.ALLOW_PUBLIC_REGISTRATION,
  ENFORCE_PREVIEW_LOCKS: process.env.ENFORCE_PREVIEW_LOCKS,
  LIVE_COMPLIANCE_APPROVAL_ID: process.env.LIVE_COMPLIANCE_APPROVAL_ID,
  KYC_PROVIDER: process.env.KYC_PROVIDER,
  AML_SCREENING_PROVIDER: process.env.AML_SCREENING_PROVIDER,
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
  CUSTODY_PROVIDER: process.env.CUSTODY_PROVIDER,
  ENABLE_TRANSACTION_MONITORING: process.env.ENABLE_TRANSACTION_MONITORING,
  ENABLE_SIGNED_PROVIDER_WEBHOOKS: process.env.ENABLE_SIGNED_PROVIDER_WEBHOOKS,
};

afterEach(() => {
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  vi.resetModules();
});

function responseMock() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { response: { status } as unknown as Response, status, json };
}

describe('production platform mode', () => {
  it('blocks financial operations in preview mode', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PLATFORM_MODE = 'preview';
    process.env.ENABLE_FINANCIAL_OPERATIONS = '0';
    vi.resetModules();
    const { requireFinancialOperations } = await import('../../server/lib/platformMode.js');
    const { response, status } = responseMock();
    expect(requireFinancialOperations(response)).toBe(false);
    expect(status).toHaveBeenCalledWith(503);
  });

  it('blocks live operations when provider readiness is incomplete', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PLATFORM_MODE = 'live';
    process.env.ENABLE_FINANCIAL_OPERATIONS = '1';
    vi.resetModules();
    const { requireFinancialOperations } = await import('../../server/lib/platformMode.js');
    const { response, status } = responseMock();
    expect(requireFinancialOperations(response)).toBe(false);
    expect(status).toHaveBeenCalledWith(503);
  });

  it('does not allow environment attestations alone to unlock live operations', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PLATFORM_MODE = 'live';
    process.env.ENABLE_FINANCIAL_OPERATIONS = '1';
    process.env.LIVE_COMPLIANCE_APPROVAL_ID = 'approved-launch-001';
    process.env.KYC_PROVIDER = 'contracted-kyc-provider';
    process.env.AML_SCREENING_PROVIDER = 'contracted-screening-provider';
    process.env.PAYMENT_PROVIDER = 'contracted-payment-provider';
    process.env.CUSTODY_PROVIDER = 'contracted-custody-provider';
    process.env.ENABLE_TRANSACTION_MONITORING = '1';
    process.env.ENABLE_SIGNED_PROVIDER_WEBHOOKS = '1';
    vi.resetModules();
    const { requireFinancialOperations } = await import('../../server/lib/platformMode.js');
    const { response, status } = responseMock();
    expect(requireFinancialOperations(response)).toBe(false);
    expect(status).toHaveBeenCalledWith(503);
  });

  it('blocks public registration unless explicitly enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_PUBLIC_REGISTRATION = '0';
    vi.resetModules();
    const { requirePublicRegistration } = await import('../../server/lib/platformMode.js');
    const { response, status } = responseMock();
    expect(requirePublicRegistration(response)).toBe(false);
    expect(status).toHaveBeenCalledWith(503);
  });

  it('can enforce production-equivalent preview locks in an isolated browser-test server', async () => {
    process.env.NODE_ENV = 'development';
    process.env.PLATFORM_MODE = 'preview';
    process.env.ENFORCE_PREVIEW_LOCKS = '1';
    vi.resetModules();
    const { requireFinancialOperations, requirePaperTrading, requirePublicRegistration } = await import('../../server/lib/platformMode.js');
    for (const guard of [requireFinancialOperations, requirePaperTrading, requirePublicRegistration]) {
      const { response, status } = responseMock();
      expect(guard(response)).toBe(false);
      expect(status).toHaveBeenCalledWith(503);
    }
  });
});
