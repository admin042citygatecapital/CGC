import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const stores = vi.hoisted(() => ({
  findUserBySessionToken: vi.fn(),
  createOrder: vi.fn(),
  appendTrade: vi.fn(),
  createPosition: vi.fn(),
  updatePosition: vi.fn(),
  getPositions: vi.fn(),
  getTicker: vi.fn(),
  requirePaperTrading: vi.fn(),
  requireCustomerFinancialAccess: vi.fn(),
}));

vi.mock('../../server/lib/userStore.js', () => ({ findUserBySessionToken: stores.findUserBySessionToken }));
vi.mock('../../server/lib/tradingStore.js', () => ({
  createOrder: stores.createOrder,
  appendTrade: stores.appendTrade,
  createPosition: stores.createPosition,
  updatePosition: stores.updatePosition,
  getPositions: stores.getPositions,
}));
vi.mock('../../server/lib/market/registry.js', () => ({
  marketRegistry: { getTicker: stores.getTicker },
}));
vi.mock('../../server/lib/platformMode.js', () => ({ requirePaperTrading: stores.requirePaperTrading }));
vi.mock('../../server/lib/complianceGate.js', () => ({ requireCustomerFinancialAccess: stores.requireCustomerFinancialAccess }));

import placeOrder from '../../server/api/users/trading/orders/POST.js';

function responseDouble() {
  const result = { status: 200, body: undefined as unknown };
  const res = {
    status(code: number) { result.status = code; return res; },
    json(body: unknown) { result.body = body; return res; },
  } as unknown as Response;
  return { res, result };
}

function orderRequest(body: Record<string, unknown>) {
  return {
    headers: { authorization: 'Bearer token-1' },
    body,
  } as unknown as Request;
}

beforeEach(() => {
  stores.requirePaperTrading.mockReset().mockReturnValue(true);
  stores.requireCustomerFinancialAccess.mockReset().mockResolvedValue(true);
  stores.findUserBySessionToken.mockReset().mockResolvedValue({ id: 'user-1', email: 'c@example.com' });
  stores.getTicker.mockReset().mockResolvedValue([{ symbol: 'BTCUSDT', price: 65_000 }]);
  stores.getPositions.mockReset().mockResolvedValue([]);
  stores.createPosition.mockReset().mockResolvedValue({ id: 'pos-1' });
  stores.updatePosition.mockReset().mockResolvedValue(undefined);
  stores.appendTrade.mockReset().mockResolvedValue(undefined);
  stores.createOrder.mockReset().mockImplementation(async (input: { type: string; quantity: number }) => ({
    id: 'ord-1',
    type: input.type,
    quantity: input.quantity,
    status: input.type === 'market' ? 'filled' : 'open',
  }));
});

describe('customer trading order placement', () => {
  it('refuses a market order when no provider quote is available', async () => {
    stores.getTicker.mockResolvedValue([]);
    const response = responseDouble();
    await placeOrder(orderRequest({
      symbol: 'BTCUSDT', assetClass: 'crypto', side: 'buy', type: 'market', quantity: 1,
    }), response.res);
    expect(response.result.status).toBe(503);
    expect(response.result.body).toMatchObject({ error: expect.stringContaining('Live pricing is unavailable') });
    expect(stores.createOrder).not.toHaveBeenCalled();
  });

  it('fills a market order at the provider price and returns the ledger fill price', async () => {
    const response = responseDouble();
    await placeOrder(orderRequest({
      symbol: 'BTCUSDT', assetClass: 'crypto', side: 'buy', type: 'market', quantity: 2,
    }), response.res);
    expect(response.result.status).toBe(201);
    const body = response.result.body as { fillPrice?: number; order: { status: string } };
    expect(body.fillPrice).toBe(65_000);
    expect(body.order.status).toBe('filled');
    expect(stores.appendTrade).toHaveBeenCalledWith(expect.objectContaining({ price: 65_000 }));
  });

  it('requires a price for limit orders', async () => {
    const response = responseDouble();
    await placeOrder(orderRequest({
      symbol: 'BTCUSDT', assetClass: 'crypto', side: 'buy', type: 'limit', quantity: 1,
    }), response.res);
    expect(response.result.status).toBe(400);
    expect(response.result.body).toMatchObject({ error: 'price is required for limit orders' });
    expect(stores.createOrder).not.toHaveBeenCalled();
  });

  it('requires a stopPrice for stop orders', async () => {
    const response = responseDouble();
    await placeOrder(orderRequest({
      symbol: 'BTCUSDT', assetClass: 'crypto', side: 'buy', type: 'stop', quantity: 1,
    }), response.res);
    expect(response.result.status).toBe(400);
    expect(response.result.body).toMatchObject({ error: 'stopPrice is required for stop orders' });
  });

  it('stores an open limit order with the stated price and no fill claim', async () => {
    const response = responseDouble();
    await placeOrder(orderRequest({
      symbol: 'BTCUSDT', assetClass: 'crypto', side: 'buy', type: 'limit', quantity: 1, price: 60_000,
    }), response.res);
    expect(response.result.status).toBe(201);
    const body = response.result.body as { fillPrice?: number; order: { status: string } };
    expect(body.order.status).toBe('open');
    expect(body.fillPrice).toBeUndefined();
    expect(stores.createOrder).toHaveBeenCalledWith(expect.objectContaining({ price: 60_000, status: 'open' }));
    expect(stores.appendTrade).not.toHaveBeenCalled();
  });
});