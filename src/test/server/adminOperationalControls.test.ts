import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  findUserById: vi.fn(),
  createTransactionIdempotent: vi.fn(),
  updateTransaction: vi.fn(),
  findWalletById: vi.fn(),
  updateWallet: vi.fn(),
  loadWallets: vi.fn(),
  appendAudit: vi.fn(),
  appendCriticalAudit: vi.fn().mockResolvedValue(undefined),
  requireFinancialOperations: vi.fn(),
  authorizeRecentAdminStepUp: vi.fn().mockReturnValue(true),
}));

vi.mock('../../server/lib/userStore.js', () => ({
  findUserById: dependencies.findUserById,
}));
vi.mock('../../server/lib/transactionStore.js', () => ({
  createTransactionIdempotent: dependencies.createTransactionIdempotent,
  updateTransaction: dependencies.updateTransaction,
  IdempotencyConflictError: class IdempotencyConflictError extends Error {},
}));
vi.mock('../../server/lib/walletStore.js', () => ({
  findWalletById: dependencies.findWalletById,
  updateWallet: dependencies.updateWallet,
  loadWallets: dependencies.loadWallets,
}));
vi.mock('../../server/lib/auditLog.js', () => ({
  appendAudit: dependencies.appendAudit,
  appendCriticalAudit: dependencies.appendCriticalAudit,
}));
vi.mock('../../server/lib/platformMode.js', () => ({
  requireFinancialOperations: dependencies.requireFinancialOperations,
}));
vi.mock('../../server/lib/complianceGate.js', () => ({
  evaluateFinancialAccess: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock('../../server/lib/rbacMiddleware.js', () => ({
  authorizeRecentAdminStepUp: dependencies.authorizeRecentAdminStepUp,
}));

import createTransaction from '../../server/api/admin/transactions/create/POST.js';
import getWallets from '../../server/api/admin/wallets/GET.js';
import updateWallet from '../../server/api/admin/wallets/PATCH.js';

function responseDouble() {
  const state: { status: number; body?: unknown } = { status: 200 };
  const res = {
    status(code: number) { state.status = code; return this; },
    json(body: unknown) { state.body = body; return this; },
  } as unknown as Response;
  return { res, state };
}

function adminRequest(body: Record<string, unknown>, idempotencyKey?: string): Request {
  return {
    body,
    ip: '127.0.0.1',
    get: (name: string) => name.toLowerCase() === 'idempotency-key' ? idempotencyKey : undefined,
    adminSession: {
      adminId: 'admin-1',
      email: 'admin@example.test',
      role: 'SUPER_ADMIN',
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      ip: '127.0.0.1',
      ua: 'vitest',
    },
  } as unknown as Request;
}

describe('controlled administration operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.authorizeRecentAdminStepUp.mockReturnValue(true);
    dependencies.requireFinancialOperations.mockImplementation((res: Response) => {
      res.status(503).json({ code: 'PREVIEW_MODE' });
      return false;
    });
    dependencies.findUserById.mockResolvedValue({
      id: 'customer-test-1',
      name: 'Synthetic Customer',
      email: 'synthetic@example.test',
    });
    dependencies.createTransactionIdempotent.mockResolvedValue({
      replayed: false,
      transaction: {
        id: 'tx-test-1',
        userId: 'customer-test-1',
        type: 'transfer',
        status: 'pending',
        amount: 25,
        currency: 'USD',
        createdAt: new Date().toISOString(),
      },
    });
    dependencies.findWalletById.mockResolvedValue({
      id: 'eth',
      symbol: 'ETH',
      name: 'Ethereum',
      network: 'ERC-20',
      address: '',
      minDeposit: 0.01,
      confirmations: 12,
      enabled: false,
      updatedAt: new Date().toISOString(),
    });
  });

  it('records a pending transfer instruction without invoking live money movement', async () => {
    const result = responseDouble();
    await createTransaction(adminRequest({
      userId: 'customer-test-1',
      type: 'transfer',
      status: 'pending',
      amount: 25,
      currency: 'USD',
      description: 'Controlled transfer review',
      note: 'Customer requested transfer review',
    }, 'transfer-test-001'), result.res);

    expect(result.state.status).toBe(201);
    expect(result.state.body).toEqual(expect.objectContaining({
      ok: true,
      executionState: 'provider_gated',
    }));
    expect(dependencies.requireFinancialOperations).not.toHaveBeenCalled();
    expect(dependencies.createTransactionIdempotent).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending',
      idempotencyKey: 'admin-transaction-create:transfer-test-001',
    }));
  });

  it('blocks a completed transfer when live financial operations are unavailable', async () => {
    const result = responseDouble();
    await createTransaction(adminRequest({
      userId: 'customer-test-1',
      type: 'transfer',
      status: 'completed',
      amount: 25,
      currency: 'USD',
      note: 'Attempted completed transfer',
    }, 'transfer-test-002'), result.res);

    expect(result.state.status).toBe(503);
    expect(dependencies.requireFinancialOperations).toHaveBeenCalledOnce();
    expect(dependencies.createTransactionIdempotent).not.toHaveBeenCalled();
  });

  it('returns resolved wallet configuration rather than a Promise value', async () => {
    dependencies.loadWallets.mockResolvedValue([{ id: 'eth', enabled: false }]);
    const result = responseDouble();
    await getWallets(adminRequest({}), result.res);
    expect(result.state.body).toEqual({ wallets: [{ id: 'eth', enabled: false }], executionEnabled: false });
  });

  it('saves a wallet address configuration without activating custody', async () => {
    const configured = {
      ...(await dependencies.findWalletById()),
      address: `0x${'a'.repeat(40)}`,
      enabled: false,
    };
    dependencies.updateWallet.mockResolvedValue(configured);
    const result = responseDouble();
    await updateWallet(adminRequest({
      id: 'eth',
      address: configured.address,
      minDeposit: 0.05,
      confirmations: 15,
      enabled: false,
      reason: 'Configure reviewed custody address',
      confirmed: true,
    }), result.res);

    expect(result.state.status).toBe(200);
    expect(result.state.body).toEqual(expect.objectContaining({ success: true, executionEnabled: false }));
    expect(dependencies.requireFinancialOperations).not.toHaveBeenCalled();
    expect(dependencies.updateWallet).toHaveBeenCalledWith('eth', expect.objectContaining({
      address: configured.address,
      enabled: false,
      updatedBy: 'admin-1',
    }));
    expect(dependencies.appendCriticalAudit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'wallet_configuration_update_intent',
      reason: 'Configure reviewed custody address',
    }));
    expect(JSON.stringify(dependencies.appendCriticalAudit.mock.calls)).not.toContain(configured.address);
  });

  it('refuses to activate wallet operations while the provider gate is closed', async () => {
    const result = responseDouble();
    await updateWallet(adminRequest({
      id: 'eth',
      enabled: true,
      reason: 'Request provider-backed activation',
      confirmed: true,
    }), result.res);

    expect(result.state.status).toBe(503);
    expect(dependencies.requireFinancialOperations).toHaveBeenCalledOnce();
    expect(dependencies.updateWallet).not.toHaveBeenCalled();
  });
});
