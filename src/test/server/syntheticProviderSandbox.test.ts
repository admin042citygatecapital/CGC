import { describe, expect, it } from 'vitest';
import { SyntheticProviderAdapter, signSyntheticWebhook, verifySyntheticWebhook } from '../../server/lib/syntheticProviderSandbox.js';

const command = (name: string) => ({ idempotencyKey: `idem-${name}`, correlationId: `corr-${name}` });

describe('synthetic provider sandbox', () => {
  it('rejects non-synthetic identity references', async () => {
    const adapter = new SyntheticProviderAdapter();
    await expect(adapter.verifyIndividual({ ...command('identity'), subjectRef: 'customer-real-123' })).rejects.toMatchObject({ code: 'SYNTHETIC_REFERENCE_REQUIRED' });
  });

  it('produces deterministic idempotent provider identifiers', async () => {
    const adapter = new SyntheticProviderAdapter();
    const input = { ...command('identity'), subjectRef: 'syn_customer_001' };
    expect(await adapter.verifyIndividual(input)).toEqual(await adapter.verifyIndividual(input));
  });

  it('covers sanctions, PEP and adverse-media screening explicitly', async () => {
    const result = await new SyntheticProviderAdapter().screen({ ...command('screen'), subjectRef: 'syn_customer_001', reason: 'onboarding' });
    expect(result).toMatchObject({ sanctions: 'clear', pep: 'clear', adverseMedia: 'clear', synthetic: true, status: 'accepted' });
  });

  it('rejects an unbalanced posting batch', async () => {
    const adapter = new SyntheticProviderAdapter();
    await expect(adapter.post({ ...command('ledger'), postingBatchId: 'syn_batch_001', entries: [
      { accountRef: 'syn_account_001', debit: '10.00', currency: 'GBP' },
      { accountRef: 'syn_account_002', credit: '9.00', currency: 'GBP' },
    ] })).rejects.toMatchObject({ code: 'UNBALANCED_LEDGER' });
  });

  it('verifies signed webhooks and rejects tampering or stale events', () => {
    const secret = 'synthetic-webhook-secret-32-characters';
    const envelope = signSyntheticWebhook({ status: 'accepted' }, secret, 'syn_event_001');
    expect(verifySyntheticWebhook(envelope, secret)).toBe(true);
    expect(verifySyntheticWebhook({ ...envelope, payload: { status: 'rejected' } }, secret)).toBe(false);
    expect(verifySyntheticWebhook(envelope, secret, Date.now() + 600_000)).toBe(false);
  });
});
