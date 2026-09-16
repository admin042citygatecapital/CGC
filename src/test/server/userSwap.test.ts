import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FxMarkups } from '../../server/lib/ratesStore.js';

const deps = vi.hoisted(() => ({
  user: {
    id: 'user-1', name: 'Swap User', email: 'swap@example.com',
    status: 'active', kycStatus: 'approved', kycApprovedAt: new Date().toISOString(),
    kycReviewedBy: 'admin-1', kycReviewReason: 'Reviewed identity evidence thoroughly.',
    amlStatus: 'cleared', amlRiskLevel: 'low',
    amlReviewedAt: new Date().toISOString(), amlReviewedBy: 'admin-1',
    amlReviewReason: 'Reviewed sanctions and screening evidence.', amlNextReviewAt: new Date(Date.now() + 86400000).toISOString(),
    emailVerified: true,
  },
  sessionUser: null as unknown,
  rates: {
    rates: {
      EUR_USD: 1.08, GBP_USD: 1.27, CHF_USD: 1.1, CAD_USD: 0.73, AUD_USD: 0.66,
      JPY_USD: 0.0067, SGD_USD: 0.74, AED_USD: 0.27, NGN_USD: 0.00065,
      BTC_USD: 67000, ETH_USD: 3500, SOL_USD: 170, USDT_USD: 1, BNB_USD: 590,
    },
    txFees: { currency_exchange: { mode: 'percentage', flat: 0, percentage: 0, minFee: 0, maxFee: 0, enabled: false } },
    fxMarkups: { pairs: [] } as FxMarkups,
  },
  swapResult: { ok: true, replayed: false, sourceBalance: 4.9, usdBalance: 1000 } as unknown,
}));

vi.mock('../../server/lib/userStore.js', () => ({
  findUserBySessionToken: vi.fn(async () => deps.sessionUser),
}));
vi.mock('../../server/lib/transactionStore.js', () => ({
  createTransaction: vi.fn(async (input: Record<string, unknown>) => input),
}));
vi.mock('../../server/lib/financialOperationStore.js', () => ({
  executeSwapOperation: vi.fn(async () => deps.swapResult),
}));
vi.mock('../../server/lib/ratesStore.js', () => ({
  readRatesConfig: () => deps.rates,
}));
vi.mock('../../server/lib/inputValidator.js', () => ({
  isOneOf: (value: unknown, list: readonly string[]) =>
    typeof value === 'string' && (list as readonly string[]).includes(value) ? value : null,
}));
vi.mock('../../server/lib/idempotency.js', () => ({
  requireIdempotency: vi.fn(() => ({ key: 'swap:test-key', fingerprint: 'fp' })),
}));
vi.mock('../../server/lib/platformMode.js', () => ({ requireFinancialOperations: () => true }));
vi.mock('../../server/lib/complianceGate.js', () => ({ requireCustomerFinancialAccess: async () => true }));

import swapHandler from '../../server/api/users/swap/POST.js';

function responseDouble() {
  const result = { status: 200, body: undefined as unknown };
  const res = {
    status(code: number) { result.status = code; return res; },
    json(body: unknown) { result.body = body; return res; },
  } as unknown as Response;
  return { res, result };
}

function swapRequest(body: Record<string, unknown>) {
  return {
    headers: { authorization: 'Bearer token-1' },
    get(name: string) { return name === 'Idempotency-Key' ? 'test-key-123' : undefined; },
    body,
  } as unknown as Request;
}

beforeEach(() => {
  deps.sessionUser = deps.user;
  deps.swapResult = { ok: true, replayed: false, sourceBalance: 4.9, usdBalance: 1000 };
});

describe('POST /api/users/swap contract (Bug 4 server side)', () => {
  it('requires authentication', async () => {
    deps.sessionUser = null;
    const response = responseDouble();
    await swapHandler(swapRequest({ fromAsset: 'BTC', toAsset: 'USD', amount: 0.1 }), response.res);
    expect(response.result.status).toBe(401);
  });

  it('rejects unsupported assets', async () => {
    const response = responseDouble();
    await swapHandler(swapRequest({ fromAsset: 'DOGE', toAsset: 'USD', amount: 1 }), response.res);
    expect(response.result.status).toBe(400);
    expect(response.result.body).toMatchObject({ error: expect.stringContaining('DOGE') });
  });

  it('rejects non-positive and unbounded amounts', async () => {
    for (const amount of [0, -1, Number.NaN, 1e15]) {
      const response = responseDouble();
      await swapHandler(swapRequest({ fromAsset: 'BTC', toAsset: 'ETH', amount }), response.res);
      expect(response.result.status).toBe(400);
      expect(response.result.body).toMatchObject({ error: expect.stringContaining('Amount') });
    }
  });

  it('rejects swapping an asset for itself', async () => {
    const response = responseDouble();
    await swapHandler(swapRequest({ fromAsset: 'BTC', toAsset: 'BTC', amount: 1 }), response.res);
    expect(response.result.status).toBe(400);
    expect(response.result.body).toMatchObject({ error: expect.stringContaining('itself') });
  });

  it('converts via live rates and returns a full quote (Bug 4)', async () => {
    const response = responseDouble();
    await swapHandler(swapRequest({ fromAsset: 'BTC', toAsset: 'USD', amount: 0.1 }), response.res);
    expect(response.result.status).toBe(200);
    const body = response.result.body as {
      ok: boolean; fromAsset: string; toAsset: string;
      fromAmount: number; toAmount: number; rate: number; fee: number; markupPct: number;
    };
    expect(body.ok).toBe(true);
    expect(body.fromAsset).toBe('BTC');
    // 0.1 BTC * 67000 = 6700 USD, no markup/fees in fixture
    expect(body.toAmount).toBeCloseTo(6700, 4);
    expect(body.rate).toBeCloseTo(67000, 4);
    expect(body.fee).toBe(0);
    expect(body.markupPct).toBe(0);
  });

  it('applies the per-pair FX markup spread', async () => {
    const previous = deps.rates.fxMarkups;
    deps.rates.fxMarkups = { ...previous, pairs: [{ pair: 'BTC/USD', markup: 1, enabled: true }] };
    try {
      const response = responseDouble();
      await swapHandler(swapRequest({ fromAsset: 'BTC', toAsset: 'USD', amount: 1 }), response.res);
      const body = response.result.body as { toAmount: number; markupPct: number };
      expect(body.markupPct).toBe(1);
      expect(body.toAmount).toBeCloseTo(67000 * 0.99, 2);
    } finally {
      deps.rates.fxMarkups = previous;
    }
  });

  it('surfaces insufficient funds as 400', async () => {
    deps.swapResult = { ok: false, balance: 0.01, reason: 'insufficient_funds' };
    const response = responseDouble();
    await swapHandler(swapRequest({ fromAsset: 'BTC', toAsset: 'USD', amount: 1 }), response.res);
    expect(response.result.status).toBe(400);
    expect(response.result.body).toMatchObject({ error: expect.stringContaining('Insufficient BTC balance') });
  });
});
