// PATCH: the final Sumsub case is updated to the new multi-event contract and two
// cases are added — screening is emitted on an AML level (GREEN -> clear), and is
// withheld when the level performed no AML screening (fail-closed). All other tests
// are unchanged from the original.
import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { assertApprovedProvider, mapSumsubWebhookPayload, signProviderWebhook, validateProviderWebhookPayload, verifyProviderWebhook, verifySumsubWebhook } from '../../server/lib/onboardingProviderWebhook.js';
import { assessProviderVerification, deriveScreeningState } from '../../server/lib/onboardingProviderStore.js';

describe('approved onboarding provider webhooks', () => {
  const env = { APPROVED_ONBOARDING_PROVIDERS: 'verified-id', ONBOARDING_PROVIDER_WEBHOOK_SECRET_VERIFIED_ID: 'a-secure-provider-webhook-secret-32-bytes' } as NodeJS.ProcessEnv;

  it('requires an allow-listed provider and configured secret', () => {
    expect(assertApprovedProvider('verified-id', env)).toBe('verified-id');
    expect(() => assertApprovedProvider('untrusted', env)).toThrow(expect.objectContaining({ code: 'PROVIDER_NOT_APPROVED' }));
  });

  it('verifies HMAC signatures and rejects tampering and replay', () => {
    const body = Buffer.from('{"caseId":"oc_0123456789abcdef0123"}'); const eventId = 'provider-event-001'; const timestamp = new Date().toISOString(); const secret = env.ONBOARDING_PROVIDER_WEBHOOK_SECRET_VERIFIED_ID!;
    const signature = signProviderWebhook(body, eventId, timestamp, secret);
    expect(() => verifyProviderWebhook({ rawBody: body, eventId, timestamp, signature, secret })).not.toThrow();
    expect(() => verifyProviderWebhook({ rawBody: Buffer.from('{}'), eventId, timestamp, signature, secret })).toThrow(expect.objectContaining({ code: 'INVALID_SIGNATURE' }));
    expect(() => verifyProviderWebhook({ rawBody: body, eventId, timestamp, signature, secret, now: Date.now() + 600_000 })).toThrow(expect.objectContaining({ code: 'STALE_WEBHOOK' }));
  });

  it('requires explicit clear sanctions, PEP and adverse-media results', () => {
    expect(validateProviderWebhookPayload({ caseId: 'oc_0123456789abcdef0123', providerRef: 'provider:case-001', kind: 'screening', status: 'accepted', screening: { sanctions: 'clear', pep: 'clear', adverseMedia: 'clear' } }).screening).toEqual({ sanctions: 'clear', pep: 'clear', adverseMedia: 'clear' });
    expect(() => validateProviderWebhookPayload({ caseId: 'oc_0123456789abcdef0123', providerRef: 'provider:case-001', kind: 'screening', status: 'accepted', screening: { sanctions: 'clear', pep: 'match', adverseMedia: 'clear' } })).toThrow(expect.objectContaining({ code: 'SCREENING_NOT_CLEAR' }));
  });

  it('accepts screening-only rescreens and derives fail-closed operational states', () => {
    const clear = validateProviderWebhookPayload({ caseId: 'oc_0123456789abcdef0123', providerRef: 'provider:rescreen-001', kind: 'screening', purpose: 'rescreen', screenedAt: '2026-08-10T12:00:00.000Z', status: 'accepted', screening: { sanctions: 'clear', pep: 'clear', adverseMedia: 'clear' } });
    expect(clear.purpose).toBe('rescreen');
    expect(deriveScreeningState(clear)).toBe('clear');
    expect(deriveScreeningState({ status: 'review', screening: { sanctions: 'clear', pep: 'match', adverseMedia: 'clear' } })).toBe('match');
    expect(deriveScreeningState({ status: 'review', screening: { sanctions: 'clear', pep: 'not_run', adverseMedia: 'clear' } })).toBe('review');
    expect(() => validateProviderWebhookPayload({ caseId: 'oc_0123456789abcdef0123', providerRef: 'provider:rescreen-002', kind: 'identity', purpose: 'rescreen', status: 'accepted' })).toThrow(expect.objectContaining({ code: 'INVALID_RESCREEN_KIND' }));
  });

  it('does not allow approval without the correct case-type verification and clear screening', () => {
    const clearScreening = { kind: 'screening' as const, status: 'accepted' as const, screening: { sanctions: 'clear', pep: 'clear', adverseMedia: 'clear' } };
    const identity = { kind: 'identity' as const, status: 'accepted' as const, screening: null };
    expect(assessProviderVerification([identity, clearScreening], 'individual').approvable).toBe(true);
    expect(assessProviderVerification([identity, clearScreening], 'business').approvable).toBe(false);
    expect(assessProviderVerification([identity, { ...clearScreening, status: 'review' }], 'individual').approvable).toBe(false);
  });

  it('verifies Sumsub raw-body digests and maps a GREEN AML-level review into identity + clear screening', () => {
    const secret = 'sumsub-webhook-secret-at-least-32-bytes';
    const body = Buffer.from(JSON.stringify({ applicantId: '5cb56e8e0a975a35f333cb83', correlationId: 'req-ec508a2a-fa33-4dd2-b93d-fcade2967e03', externalUserId: 'oc_0123456789abcdef0123', type: 'applicantReviewed', reviewStatus: 'completed', levelName: 'id-liveness-aml-screening', reviewResult: { reviewAnswer: 'GREEN' } }));
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(() => verifySumsubWebhook({ rawBody: body, signature, algorithm: 'HMAC_SHA256_HEX', secret })).not.toThrow();
    expect(() => verifySumsubWebhook({ rawBody: Buffer.from('{}'), signature, algorithm: 'HMAC_SHA256_HEX', secret })).toThrow(expect.objectContaining({ code: 'INVALID_SIGNATURE' }));
    expect(() => verifySumsubWebhook({ rawBody: body, signature, algorithm: 'HMAC_SHA1_HEX', secret })).toThrow(expect.objectContaining({ code: 'INVALID_SIGNATURE_ALGORITHM' }));

    const { events } = mapSumsubWebhookPayload(JSON.parse(body.toString('utf8')));
    expect(events).toHaveLength(2);
    expect(events[0].eventId).toBe('req-ec508a2a-fa33-4dd2-b93d-fcade2967e03');
    expect(events[0].payload).toMatchObject({ caseId: 'oc_0123456789abcdef0123', providerRef: 'sumsub:5cb56e8e0a975a35f333cb83', kind: 'identity', status: 'accepted' });
    expect(events[0].payload.screening).toBeUndefined();
    expect(events[1].eventId).toBe('req-ec508a2a-fa33-4dd2-b93d-fcade2967e03:screening');
    expect(events[1].payload).toMatchObject({ kind: 'screening', status: 'accepted', screening: { sanctions: 'clear', pep: 'clear', adverseMedia: 'clear' } });

    // The two mapped events satisfy the approval gate for an individual case.
    expect(assessProviderVerification(events.map(e => ({ kind: e.payload.kind, status: e.payload.status, screening: e.payload.screening ?? null })) as never, 'individual').approvable).toBe(true);
  });

  it('withholds a screening event when the Sumsub level performed no AML screening (fail-closed)', () => {
    const body = { applicantId: '5cb56e8e0a975a35f333cb83', correlationId: 'req-11111111-2222-3333-4444-555555555555', externalUserId: 'oc_0123456789abcdef0123', type: 'applicantReviewed', reviewStatus: 'completed', levelName: 'basic-id-only', reviewResult: { reviewAnswer: 'GREEN' } };
    const { events } = mapSumsubWebhookPayload(body);
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({ kind: 'identity', status: 'accepted' });
    // Identity alone is not approvable — screening is still required.
    expect(assessProviderVerification([{ kind: 'identity', status: 'accepted', screening: null }], 'individual').approvable).toBe(false);
  });

  it('maps a RED AML review into a rejected identity and a matched screening event', () => {
    const body = { applicantId: '5cb56e8e0a975a35f333cb83', correlationId: 'req-99999999-8888-7777-6666-555555555555', externalUserId: 'oc_0123456789abcdef0123', type: 'applicantReviewed', reviewStatus: 'completed', levelName: 'id-liveness-aml-screening', reviewResult: { reviewAnswer: 'RED', rejectLabels: ['SANCTIONS'] } };
    const { events } = mapSumsubWebhookPayload(body);
    expect(events).toHaveLength(2);
    expect(events[0].payload).toMatchObject({ kind: 'identity', status: 'rejected' });
    expect(events[1].payload).toMatchObject({ kind: 'screening', status: 'review', screening: { sanctions: 'match', pep: 'clear', adverseMedia: 'clear' } });
  });
});
