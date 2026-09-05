import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapSumsubWebhookPayload, verifySumsubWebhook } from '../../server/lib/onboardingProviderWebhook.js';

const event = { applicantId: '5cb56e8e0a975a35f333cb83', correlationId: 'req-fixture-12345678', externalUserId: 'oc_0123456789abcdef0123', applicantType: 'individual', type: 'applicantReviewed', reviewStatus: 'completed', sandboxMode: false, reviewResult: { reviewAnswer: 'GREEN' } };

afterEach(() => { vi.doUnmock('../../server/db/db.js'); vi.resetModules(); });

describe('Sumsub production evidence boundaries', () => {
  it('verifies both supported raw-body algorithms and rejects altered bytes', () => {
    const rawBody = Buffer.from(JSON.stringify(event));
    const secret = 'test-only-secret-not-a-production-key-1234';
    for (const [algorithm, hash] of [['HMAC_SHA256_HEX', 'sha256'], ['HMAC_SHA512_HEX', 'sha512']]) {
      const signature = crypto.createHmac(hash, secret).update(rawBody).digest('hex');
      expect(() => verifySumsubWebhook({rawBody, secret, algorithm, signature})).not.toThrow();
      expect(() => verifySumsubWebhook({rawBody: Buffer.concat([rawBody, Buffer.from(' ')]), secret, algorithm, signature})).toThrow(expect.objectContaining({code:'INVALID_SIGNATURE'}));
    }
  });
  it('rejects sandbox and manually generated test events', () => {
    for (const flags of [{sandboxMode:true}, {testMode:true}, {sandboxMode:'false'}]) {
      expect(() => mapSumsubWebhookPayload({...event,...flags})).toThrow(expect.objectContaining({code:'NON_PRODUCTION_PROVIDER_EVENT'}));
    }
  });
  it('keeps identity acceptance separate from AML and maps KYB and retry decisions', () => {
    expect(mapSumsubWebhookPayload(event).payload).toMatchObject({kind:'identity',status:'accepted'});
    expect(mapSumsubWebhookPayload(event).payload.screening).toBeUndefined();
    expect(mapSumsubWebhookPayload({...event, applicantType:'company'}).payload.kind).toBe('kyb');
    expect(mapSumsubWebhookPayload({...event, reviewResult:{reviewAnswer:'RED',reviewRejectType:'RETRY'}}).payload.status).toBe('review');
  });
  it.each([true, false])('commits evidence only when the case version update succeeds (%s)', async successful => {
    const { onboardingCases, onboardingEvidence, onboardingEvents, onboardingProviderEvents, users } = await import('../../server/db/schema.js');
    const committed: unknown[] = [];
    const updateFilters: unknown[] = [];
    const current = {id:event.externalUserId,userId:'user-fixture',status:'under_review',version:3};
    const db = {
      select: () => ({from: (table: unknown) => ({where: () => ({limit: async () => table === onboardingCases ? [current] : table === users ? [{dataClassification:'production'}] : []})})}),
      transaction: async (work: (tx: unknown) => Promise<void>) => {
        const pending: unknown[] = [];
        const tx = {
          insert: (table: unknown) => ({values: async (value: unknown) => {pending.push({table,value});}}),
          update: () => ({set: () => ({where: (predicate: unknown) => {
            updateFilters.push(predicate);
            return {returning: async () => successful ? [{id:current.id}] : []};
          }})}),
        };
        await work(tx);
        committed.push(...pending);
      },
    };
    vi.doMock('../../server/db/db.js', () => ({getDb:()=>db,isDatabaseConfigured:()=>true}));
    const { recordOnboardingProviderEvent } = await import('../../server/lib/onboardingProviderStore.js');
    const payload = mapSumsubWebhookPayload(event);
    const result = recordOnboardingProviderEvent({...payload.payload,eventId:payload.eventId,providerCode:'sumsub',payloadSha256:'a'.repeat(64)});
    if (successful) {
      await expect(result).resolves.toMatchObject({accepted:true});
      expect(committed).toHaveLength(3);
      expect(committed).toEqual(expect.arrayContaining([expect.objectContaining({table:onboardingProviderEvents}),expect.objectContaining({table:onboardingEvidence}),expect.objectContaining({table:onboardingEvents})]));
    } else {
      await expect(result).rejects.toMatchObject({code:'WORKFLOW_CONFLICT'});
      expect(committed).toHaveLength(0);
    }
    expect(updateFilters).toHaveLength(1);
  });
});
