import { describe, expect, it } from 'vitest';
import { SyntheticProviderAdapter, SyntheticWebhookReplayGuard, signSyntheticWebhook, verifySyntheticWebhook } from '../../server/lib/syntheticProviderSandbox.js';

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

  it('rejects reuse of an idempotency key with changed input', async () => {
    const adapter = new SyntheticProviderAdapter();
    await adapter.verifyIndividual({ ...command('identity-conflict'), subjectRef: 'syn_customer_001' });
    await expect(adapter.verifyIndividual({ ...command('identity-conflict'), subjectRef: 'syn_customer_002' }))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
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

  it('enforces quote issuance and expiry before conversion', async () => {
    let now = Date.parse('2026-08-11T00:00:00Z');
    const adapter = new SyntheticProviderAdapter(() => now);
    await expect(adapter.convert({ ...command('unknown-quote'), quoteId: 'syn_fxquote_unknown' }))
      .rejects.toMatchObject({ code: 'QUOTE_NOT_FOUND' });
    const quote = await adapter.quote({ ...command('quote-expiry'), sell: 'GBP', buy: 'EUR', amount: '10.00' });
    now += 60_001;
    await expect(adapter.convert({ ...command('expired-conversion'), quoteId: quote.quoteId }))
      .rejects.toMatchObject({ code: 'QUOTE_EXPIRED' });
  });

  it('allows idempotent conversion replay but prevents a second conversion', async () => {
    const adapter = new SyntheticProviderAdapter();
    const quote = await adapter.quote({ ...command('quote-once'), sell: 'GBP', buy: 'USD', amount: '25.00' });
    const conversion = { ...command('convert-once'), quoteId: quote.quoteId };
    expect(await adapter.convert(conversion)).toEqual(await adapter.convert(conversion));
    await expect(adapter.convert({ ...command('convert-twice'), quoteId: quote.quoteId }))
      .rejects.toMatchObject({ code: 'QUOTE_ALREADY_CONVERTED' });
  });

  it('only reverses payments executed by the same sandbox session', async () => {
    const adapter = new SyntheticProviderAdapter();
    await expect(adapter.reverse({ ...command('unknown-payment'), providerPaymentId: 'syn_payment_unknown', reason: 'Synthetic return' }))
      .rejects.toMatchObject({ code: 'PAYMENT_NOT_FOUND' });
    const payment = await adapter.execute({ ...command('payment'), paymentRef: 'syn_payment_001', corridorId: 'syn_corridor_uk' });
    const reversal = { ...command('reversal'), providerPaymentId: payment.providerId, reason: 'Synthetic return' };
    expect(await adapter.reverse(reversal)).toEqual(await adapter.reverse(reversal));
    await expect(adapter.reverse({ ...command('second-reversal'), providerPaymentId: payment.providerId, reason: 'Second synthetic return' }))
      .rejects.toMatchObject({ code: 'PAYMENT_ALREADY_REVERSED' });
  });

  it('verifies signed webhooks and rejects tampering or stale events', () => {
    const secret = 'synthetic-webhook-secret-32-characters';
    const envelope = signSyntheticWebhook({ status: 'accepted' }, secret, 'syn_event_001');
    expect(verifySyntheticWebhook(envelope, secret)).toBe(true);
    expect(verifySyntheticWebhook({ ...envelope, payload: { status: 'rejected' } }, secret)).toBe(false);
    expect(verifySyntheticWebhook(envelope, secret, Date.now() + 600_000)).toBe(false);
  });

  it('rejects a replayed signed webhook event', () => {
    const secret = 'synthetic-webhook-secret-32-characters';
    const envelope = signSyntheticWebhook({ status: 'accepted' }, secret, 'syn_event_replay');
    const guard = new SyntheticWebhookReplayGuard();
    expect(guard.verify(envelope, secret)).toBe(true);
    expect(guard.verify(envelope, secret)).toBe(false);
  });
});
