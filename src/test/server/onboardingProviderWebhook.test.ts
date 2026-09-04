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

  it('verifies Sumsub raw-body digests and maps only explicit identity decisions', () => {
    const secret = 'sumsub-webhook-secret-at-least-32-bytes';
    const body = Buffer.from(JSON.stringify({ applicantId: '5cb56e8e0a975a35f333cb83', correlationId: 'req-ec508a2a-fa33-4dd2-b93d-fcade2967e03', externalUserId: 'oc_0123456789abcdef0123', type: 'applicantReviewed', reviewStatus: 'completed', reviewResult: { reviewAnswer: 'GREEN' } }));
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(() => verifySumsubWebhook({ rawBody: body, signature, algorithm: 'HMAC_SHA256_HEX', secret })).not.toThrow();
    expect(() => verifySumsubWebhook({ rawBody: Buffer.from('{}'), signature, algorithm: 'HMAC_SHA256_HEX', secret })).toThrow(expect.objectContaining({ code: 'INVALID_SIGNATURE' }));
    expect(() => verifySumsubWebhook({ rawBody: body, signature, algorithm: 'HMAC_SHA1_HEX', secret })).toThrow(expect.objectContaining({ code: 'INVALID_SIGNATURE_ALGORITHM' }));
    const mapped = mapSumsubWebhookPayload(JSON.parse(body.toString('utf8')));
    expect(mapped.eventId).toBe('req-ec508a2a-fa33-4dd2-b93d-fcade2967e03');
    expect(mapped.payload).toMatchObject({ caseId: 'oc_0123456789abcdef0123', providerRef: 'sumsub:5cb56e8e0a975a35f333cb83', kind: 'identity', status: 'accepted' });
    expect(mapped.payload.screening).toBeUndefined();
  });
});
