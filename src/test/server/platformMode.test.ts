import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

const original = {
  NODE_ENV: process.env.NODE_ENV,
  PLATFORM_MODE: process.env.PLATFORM_MODE,
  ENABLE_FINANCIAL_OPERATIONS: process.env.ENABLE_FINANCIAL_OPERATIONS,
  ENABLE_PAPER_TRADING: process.env.ENABLE_PAPER_TRADING,
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

  it('requires both live mode and explicit enablement', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PLATFORM_MODE = 'live';
    process.env.ENABLE_FINANCIAL_OPERATIONS = '1';
    vi.resetModules();
    const { requireFinancialOperations } = await import('../../server/lib/platformMode.js');
    const { response, status } = responseMock();
    expect(requireFinancialOperations(response)).toBe(true);
    expect(status).not.toHaveBeenCalled();
  });
});
