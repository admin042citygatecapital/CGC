import { beforeEach, describe, expect, it, vi } from 'vitest';

const files = new Map<string, string>();

vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn((path: string) => files.has(String(path))),
    readFileSync: vi.fn((path: string) => files.get(String(path)) ?? ''),
    writeFileSync: vi.fn((path: string, data: string) => {
      files.set(String(path), String(data));
    }),
    mkdirSync: vi.fn(),
  };
});

describe('executeDebitOperation', () => {
  beforeEach(() => files.clear());

  it('serializes concurrent debits so funds cannot be spent twice', async () => {
    const { createUser, findUserById } = await import('../../server/lib/userStore.js');
    const { executeDebitOperation } = await import('../../server/lib/financialOperationStore.js');
    const { getTransactionsForUser } = await import('../../server/lib/transactionStore.js');

    const user = await createUser({
      email: 'debit@example.com',
      name: 'Debit Test',
      passwordHash: 'test-only',
      status: 'active',
      kycStatus: 'approved',
      emailVerified: true,
      balance: 100,
    });

    const primary = {
      type: 'transfer' as const,
      status: 'completed' as const,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      amount: 80,
      currency: 'USD' as const,
      description: 'Concurrent debit test',
    };

    const [first, second] = await Promise.all([
      executeDebitOperation({ user, debitUsd: 80, primary }),
      executeDebitOperation({ user, debitUsd: 80, primary }),
    ]);

    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    expect((await findUserById(user.id))?.balance).toBe(20);

    const ledger = await getTransactionsForUser(user.id, { limit: 10 });
    expect(ledger.total).toBe(1);
    expect(ledger.transactions[0]?.amount).toBe(80);
  });

  it('writes the balance, primary transaction, and fee together', async () => {
    const { createUser, findUserById } = await import('../../server/lib/userStore.js');
    const { executeDebitOperation } = await import('../../server/lib/financialOperationStore.js');
    const { getTransactionsForUser } = await import('../../server/lib/transactionStore.js');

    const user = await createUser({
      email: 'fee@example.com',
      name: 'Fee Test',
      passwordHash: 'test-only',
      status: 'active',
      kycStatus: 'approved',
      emailVerified: true,
      balance: 100,
    });

    const common = {
      status: 'completed' as const,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      currency: 'USD' as const,
    };
    const result = await executeDebitOperation({
      user,
      debitUsd: 55,
      primary: { ...common, type: 'transfer', amount: 50, description: 'Transfer' },
      fee: { ...common, type: 'fee', amount: 5, description: 'Transfer fee' },
    });

    expect(result.ok).toBe(true);
    expect((await findUserById(user.id))?.balance).toBe(45);
    expect((await getTransactionsForUser(user.id, { limit: 10 })).total).toBe(2);
  });

  it('replays the same idempotent debit without charging twice', async () => {
    const { createUser, findUserById } = await import('../../server/lib/userStore.js');
    const { executeDebitOperation } = await import('../../server/lib/financialOperationStore.js');
    const { getTransactionsForUser } = await import('../../server/lib/transactionStore.js');

    const user = await createUser({
      email: 'idempotent@example.com', name: 'Idempotency Test', passwordHash: 'test-only',
      status: 'active', kycStatus: 'approved', emailVerified: true, balance: 100,
    });
    const primary = {
      type: 'transfer' as const, status: 'completed' as const,
      userId: user.id, userName: user.name, userEmail: user.email,
      amount: 80, currency: 'USD' as const, description: 'Idempotent debit',
      idempotencyKey: 'transfer:test-key', idempotencyFingerprint: 'same-request',
    };

    const [first, second] = await Promise.all([
      executeDebitOperation({ user, debitUsd: 80, primary }),
      executeDebitOperation({ user, debitUsd: 80, primary }),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect([first, second].filter(result => result.ok && result.replayed)).toHaveLength(1);
    expect((await findUserById(user.id))?.balance).toBe(20);
    expect((await getTransactionsForUser(user.id, { limit: 10 })).total).toBe(1);
  });

  it('rejects reusing an idempotency key with different input', async () => {
    const { createUser } = await import('../../server/lib/userStore.js');
    const { executeDebitOperation } = await import('../../server/lib/financialOperationStore.js');

    const user = await createUser({
      email: 'conflict@example.com', name: 'Conflict Test', passwordHash: 'test-only',
      status: 'active', kycStatus: 'approved', emailVerified: true, balance: 100,
    });
    const common = {
      type: 'transfer' as const, status: 'completed' as const,
      userId: user.id, userName: user.name, userEmail: user.email,
      amount: 10, currency: 'USD' as const, description: 'Idempotency conflict',
      idempotencyKey: 'transfer:conflict-key',
    };
    await executeDebitOperation({
      user, debitUsd: 10, primary: { ...common, idempotencyFingerprint: 'request-a' },
    });
    const conflict = await executeDebitOperation({
      user, debitUsd: 10, primary: { ...common, idempotencyFingerprint: 'request-b' },
    });

    expect(conflict).toMatchObject({ ok: false, reason: 'idempotency_conflict' });
  });

  it('prevents concurrent swaps from overspending a non-USD asset', async () => {
    const { createUser } = await import('../../server/lib/userStore.js');
    const { createTransaction, getTransactionsForUser } = await import('../../server/lib/transactionStore.js');
    const { executeSwapOperation } = await import('../../server/lib/financialOperationStore.js');

    const user = await createUser({
      email: 'swap@example.com',
      name: 'Swap Test',
      passwordHash: 'test-only',
      status: 'active',
      kycStatus: 'approved',
      emailVerified: true,
      balance: 0,
    });
    const common = {
      status: 'completed' as const,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
    };
    await createTransaction({
      ...common,
      type: 'deposit',
      amount: 1,
      currency: 'BTC',
      description: 'Initial BTC funding',
    });

    const operation = {
      user,
      fromAsset: 'BTC' as const,
      toAsset: 'USD' as const,
      fromAmount: 0.75,
      toAmount: 45_000,
      feeInFrom: 0,
      debit: { ...common, type: 'withdrawal' as const, amount: 0.75, currency: 'BTC' as const, description: 'Sell BTC' },
      credit: { ...common, type: 'deposit' as const, amount: 45_000, currency: 'USD' as const, description: 'Receive USD' },
    };

    const outcomes = await Promise.all([
      executeSwapOperation(operation),
      executeSwapOperation(operation),
    ]);
    expect(outcomes.filter(result => result.ok)).toHaveLength(1);

    const ledger = await getTransactionsForUser(user.id, { limit: 10 });
    expect(ledger.total).toBe(3);
  });
});
