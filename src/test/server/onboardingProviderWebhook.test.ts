import { describe, expect, it } from 'vitest';
import { assertApprovedProvider, signProviderWebhook, validateProviderWebhookPayload, verifyProviderWebhook } from '../../server/lib/onboardingProviderWebhook.js';
import { assessProviderVerification } from '../../server/lib/onboardingProviderStore.js';

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

  it('does not allow approval without the correct case-type verification and clear screening', () => {
    const clearScreening = { kind: 'screening' as const, status: 'accepted' as const, screening: { sanctions: 'clear', pep: 'clear', adverseMedia: 'clear' } };
    const identity = { kind: 'identity' as const, status: 'accepted' as const, screening: null };
    expect(assessProviderVerification([identity, clearScreening], 'individual').approvable).toBe(true);
    expect(assessProviderVerification([identity, clearScreening], 'business').approvable).toBe(false);
    expect(assessProviderVerification([identity, { ...clearScreening, status: 'review' }], 'individual').approvable).toBe(false);
  });
});
