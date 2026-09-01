import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  users: [] as Array<Record<string, unknown>>,
  transactions: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../server/lib/userStore.js', () => ({
  loadAllUsers: vi.fn(async () => dependencies.users),
}));
vi.mock('../../server/lib/transactionStore.js', () => ({
  queryTransactions: vi.fn(async () => ({ data: dependencies.transactions })),
}));
vi.mock('../../server/lib/ratesStore.js', () => ({
  readRatesConfig: () => ({
    rates: {
      EUR_USD: 1, GBP_USD: 1, CHF_USD: 1, CAD_USD: 1, AUD_USD: 1,
      JPY_USD: 1, SGD_USD: 1, AED_USD: 1, NGN_USD: 1,
      BTC_USD: 1, ETH_USD: 1, SOL_USD: 1, USDT_USD: 1, BNB_USD: 1,
    },
  }),
}));

const createdAt = new Date().toISOString();
function user(id: string, dataClassification: string, email = `${id}@outlook.com`, quarantineBatchId?: string) {
  return {
    id, name: id, email, status: 'active', kycStatus: 'approved',
    accountTier: 'personal', country: 'US', createdAt, dataClassification, quarantineBatchId,
  };
}
function transaction(id: string, userId: string, dataClassification = 'application_record') {
  return {
    id, userId, userName: userId, userEmail: `${userId}@example.test`, type: 'deposit',
    status: 'completed', amount: 100, currency: 'USD', reference: `CGC-${id}`,
    description: 'test', flagged: false, createdAt, updatedAt: createdAt, dataClassification,
  };
}

describe('operational report classification', () => {
  beforeEach(() => {
    dependencies.users = [
      user('real-customer', 'customer'),
      user('synthetic-customer', 'synthetic_test'),
      user('demo-customer', 'demo'),
      user('reserved-domain-customer', 'customer', 'legacy-demo@example.com'),
      user('quarantined-customer', 'customer', 'quarantined@outlook.com', 'batch-test'),
    ];
    dependencies.transactions = [
      transaction('real', 'real-customer'),
      transaction('synthetic-user', 'synthetic-customer'),
      transaction('synthetic-record', 'real-customer', 'synthetic_preview'),
    ];
  });

  it('excludes classified, reserved-domain, and quarantined customers from customer and KYC metrics', async () => {
    const { customersReport, kycReport } = await import('../../server/lib/reportsStore.js');
    const customers = await customersReport({ period: 'all' });
    const kyc = await kycReport({ period: 'all' });

    expect(customers.kpis.total.value).toBe(1);
    expect(customers.recentUsers.map(item => item.id)).toEqual(['real-customer']);
    expect(kyc.kpis.total.value).toBe(1);
  });

  it('excludes transactions owned by synthetic customers and synthetic transaction records', async () => {
    const { transactionsReport } = await import('../../server/lib/reportsStore.js');
    const report = await transactionsReport({ period: 'all' });

    expect(report.kpis.total.value).toBe(1);
    expect(report.recent.map(item => item.id)).toEqual(['real']);
  });
});
