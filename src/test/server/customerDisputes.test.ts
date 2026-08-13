import { beforeEach, describe, expect, it, vi } from 'vitest';

const findTransactionById = vi.fn();
vi.mock('../../server/lib/transactionStore.js', () => ({ findTransactionById }));

describe('authenticated customer dispute intake', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    delete process.env.DATABASE_URL;
    delete process.env.NODE_ENV;
    const { syntheticDisputes } = await import('../../server/lib/syntheticDisputes.js');
    syntheticDisputes.resetForTests();
  });

  it('accepts only a transaction owned by the authenticated customer and is idempotent', async () => {
    const { syntheticDisputes } = await import('../../server/lib/syntheticDisputes.js');
    findTransactionById.mockResolvedValue({ id:'tx_owned', userId:'customer_1', reference:'CGC-OWNED', dataClassification:'synthetic' });
    const actor = { id:'customer_1', email:'customer@example.test', actorType:'customer' as const, correlationId:'corr-customer' };
    const input = { transactionId:'tx_owned', category:'duplicate', claim:'The same transaction appears twice on my account.', idempotencyKey:'customer-dispute-key-0001' };
    const first = await syntheticDisputes.createForCustomer(input, { id:'customer_1', email:'customer@example.test' }, actor);
    const retry = await syntheticDisputes.createForCustomer(input, { id:'customer_1', email:'customer@example.test' }, actor);
    expect(first.replayed).toBe(false);
    expect(retry.replayed).toBe(true);
    expect(retry.case.id).toBe(first.case.id);
    expect(first.case.reference).toMatch(/^SYN-DSP-/);
  });

  it('rejects cross-customer transaction identifiers without revealing the owner', async () => {
    const { syntheticDisputes } = await import('../../server/lib/syntheticDisputes.js');
    findTransactionById.mockResolvedValue({ id:'tx_other', userId:'customer_2', reference:'CGC-OTHER' });
    await expect(syntheticDisputes.createForCustomer(
      { transactionId:'tx_other', category:'unauthorised', claim:'I do not recognise this transaction on my account.', idempotencyKey:'customer-dispute-key-0002' },
      { id:'customer_1', email:'customer@example.test' },
      { id:'customer_1', email:'customer@example.test', actorType:'customer', correlationId:'corr-customer' },
    )).rejects.toMatchObject({ code:'TRANSACTION_NOT_FOUND', status:404 });
  });

  it('exposes a customer-safe timeline but not internal investigation content', async () => {
    const { syntheticDisputes } = await import('../../server/lib/syntheticDisputes.js');
    findTransactionById.mockResolvedValue({ id:'tx_owned', userId:'customer_1', reference:'CGC-OWNED' });
    const created = await syntheticDisputes.createForCustomer(
      { transactionId:'tx_owned', category:'incorrect_amount', claim:'The amount shown is different from the amount authorised.', idempotencyKey:'customer-dispute-key-0003' },
      { id:'customer_1', email:'customer@example.test' },
      { id:'customer_1', email:'customer@example.test', actorType:'customer', correlationId:'corr-customer' },
    );
    await syntheticDisputes.investigate(created.case.id, { owner:'Dispute Operations', notes:'Private investigation analysis for administrators only.' }, { id:'admin_maker', email:'admin@example.test', actorType:'admin', correlationId:'corr-admin' });
    const visible = (await syntheticDisputes.listForCustomer('customer_1'))[0] as unknown as Record<string, unknown>;
    expect(visible.reference).toBe(created.case.reference);
    expect(visible.timeline).toBeDefined();
    expect(visible).not.toHaveProperty('investigationNotes');
    expect(visible).not.toHaveProperty('owner');
    expect(JSON.stringify(visible)).not.toContain('Private investigation analysis');
  });
});
