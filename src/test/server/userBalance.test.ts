import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const stores = vi.hoisted(() => ({
  transactions: [] as Array<Record<string, unknown>>,
  rates: {
    EUR_USD: 1.08, GBP_USD: 1.27, CHF_USD: 1.1, CAD_USD: 0.73, AUD_USD: 0.66,
    JPY_USD: 0.0067, SGD_USD: 0.74, AED_USD: 0.27, NGN_USD: 0.00065,
    BTC_USD: 67000, ETH_USD: 3500, SOL_USD: 170, USDT_USD: 1, BNB_USD: 590,
  },
}));

vi.mock('../../server/lib/transactionStore.js', () => ({
  getTransactionsForUser: vi.fn(async () => ({
    transactions: stores.transactions,
    total: stores.transactions.length,
  })),
}));

vi.mock('../../server/lib/ratesStore.js', () => ({
  readRatesConfig: () => ({ rates: stores.rates }),
}));

import balanceHandler from '../../server/api/users/balance/GET.js';

function responseDouble() {
  const result = { status: 200, body: undefined as unknown };
  const res = {
    status(code: number) { result.status = code; return res; },
    json(body: unknown) { result.body = body; return res; },
  } as unknown as Response;
  return { res, result };
}

const createdAt = new Date().toISOString();
function tx(partial: Record<string, unknown>) {
  return {
    id: `tx_${Math.random().toString(36).slice(2)}`,
    userId: 'user-eur',
    userName: 'EUR User',
    userEmail: 'eur@example.com',
    status: 'completed',
    createdAt,
    updatedAt: createdAt,
    ...partial,
  };
}

beforeEach(() => { stores.transactions = []; });

describe('GET /api/users/balance contract', () => {
  it('requires authentication', async () => {
    const req = {} as unknown as Request;
    const response = responseDouble();
    await balanceHandler(req, response.res);
    expect(response.result.status).toBe(401);
  });

  it('converts an EUR-only ledger into a correct cross-currency total (Bug 1)', async () => {
    stores.transactions = [
      tx({ type: 'deposit', currency: 'EUR', amount: 1000 }),
      tx({ type: 'withdrawal', currency: 'EUR', amount: 200 }),
    ];
    const req = {
      customerUser: { id: 'user-eur', balance: 0 },
    } as unknown as Request;
    const response = responseDouble();
    await balanceHandler(req, response.res);
    expect(response.result.status).toBe(200);
    const body = response.result.body as {
      primaryCurrency: string; primaryAmount: number; totalUsd: number;
      currencies: Array<{ currency: string; amount: number; usdEquivalent: number }>;
      currencySource: string;
    };
    // 800 EUR net → 800 * 1.08 = 864 USD
    expect(body.primaryCurrency).toBe('EUR');
    expect(body.totalUsd).toBeCloseTo(864, 6);
    expect(body.primaryAmount).toBeCloseTo(800, 6);
    expect(body.currencies).toHaveLength(1);
    expect(body.currencies[0]).toMatchObject({ currency: 'EUR', amount: 800 });
    expect(body.currencies[0]!.usdEquivalent).toBeCloseTo(864, 6);
    expect(body.currencySource).toBe('auto');
  });

  it('prefers the admin-assigned primary currency (Bug 1/2)', async () => {
    stores.transactions = [tx({ type: 'deposit', currency: 'USD', amount: 500 })];
    const req = {
      customerUser: { id: 'user-1', balance: 0, primaryCurrency: 'GBP' },
    } as unknown as Request;
    const response = responseDouble();
    await balanceHandler(req, response.res);
    const body = response.result.body as { primaryCurrency: string; currencySource: string; primaryAmount: number };
    expect(body.primaryCurrency).toBe('GBP');
    expect(body.currencySource).toBe('admin');
    // 500 USD → GBP at 1.27 USD/GBP
    expect(body.primaryAmount).toBeCloseTo(500 / 1.27, 6);
  });

  it('falls back to the stored admin-set balance when no completed transactions exist (Bug 1)', async () => {
    stores.transactions = [];
    const req = {
      customerUser: { id: 'user-new', balance: 2500 },
    } as unknown as Request;
    const response = responseDouble();
    await balanceHandler(req, response.res);
    const body = response.result.body as {
      totalUsd: number; primaryAmount: number; primaryCurrency: string;
      currencies: Array<{ currency: string; amount: number }>;
    };
    expect(body.totalUsd).toBe(2500);
    expect(body.primaryAmount).toBe(2500);
    expect(body.primaryCurrency).toBe('USD');
    expect(body.currencies).toHaveLength(1);
  });

  it('counts approved transactions alongside completed ones', async () => {
    stores.transactions = [
      tx({ type: 'deposit', currency: 'USD', amount: 100, status: 'approved' }),
      tx({ type: 'deposit', currency: 'USD', amount: 50, status: 'pending' }),
    ];
    const req = { customerUser: { id: 'user-1', balance: 0 } } as unknown as Request;
    const response = responseDouble();
    await balanceHandler(req, response.res);
    const body = response.result.body as { totalUsd: number };
    expect(body.totalUsd).toBe(100);
  });

  it('ignores unknown transaction types instead of silently dropping value', async () => {
    stores.transactions = [
      tx({ type: 'deposit', currency: 'USD', amount: 100 }),
      tx({ type: 'transfer', currency: 'USD', amount: 40 }),
    ];
    const req = { customerUser: { id: 'user-1', balance: 0 } } as unknown as Request;
    const response = responseDouble();
    await balanceHandler(req, response.res);
    const body = response.result.body as { totalUsd: number };
    // 'transfer' is a debit type in this codebase — net 60
    expect(body.totalUsd).toBe(60);
  });
});
