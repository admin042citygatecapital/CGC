// PATCH: Sumsub `applicantReviewed` mapping now emits BOTH an identity/KYB event
// and a sanctions/PEP/adverse-media screening event, so the admin approval gate
// (assertProviderVerificationComplete) can actually be satisfied by Sumsub.
// Screening is only asserted when the Sumsub verification level performed AML
// screening (fail-closed otherwise). Everything outside mapSumsubWebhookPayload
// is unchanged from the original file.
import crypto from 'node:crypto';

export type ProviderVerificationKind = 'identity' | 'kyb' | 'screening';
export type ProviderVerificationStatus = 'accepted' | 'review' | 'rejected';
export type ScreeningDisposition = 'clear' | 'match' | 'not_run';

export interface ProviderWebhookPayload {
  caseId: string;
  providerRef: string;
  kind: ProviderVerificationKind;
  status: ProviderVerificationStatus;
  purpose: 'onboarding' | 'rescreen';
  screenedAt?: string;
  screening?: {
    sanctions: ScreeningDisposition;
    pep: ScreeningDisposition;
    adverseMedia: ScreeningDisposition;
  };
}

export class OnboardingProviderError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400) { super(message); }
}

export function approvedOnboardingProviders(environment = process.env): string[] {
  return String(environment.APPROVED_ONBOARDING_PROVIDERS ?? '')
    .split(',').map(value => value.trim().toLowerCase()).filter(value => /^[a-z0-9][a-z0-9_-]{1,39}$/.test(value));
}

export function providerWebhookSecret(providerCode: string, environment = process.env): string {
  const key = `ONBOARDING_PROVIDER_WEBHOOK_SECRET_${providerCode.toUpperCase().replaceAll('-', '_')}`;
  return String(environment[key] ?? '').trim();
}

export function onboardingProviderConfigured(environment = process.env): boolean {
  const providers = approvedOnboardingProviders(environment);
  return providers.length > 0 && providers.every(provider => providerWebhookSecret(provider, environment).length >= 32);
}

export function assertApprovedProvider(providerCode: string, environment = process.env): string {
  const normalized = providerCode.trim().toLowerCase();
  if (!approvedOnboardingProviders(environment).includes(normalized)) {
    throw new OnboardingProviderError('Provider is not approved for onboarding.', 'PROVIDER_NOT_APPROVED', 403);
  }
  if (providerWebhookSecret(normalized, environment).length < 32) {
    throw new OnboardingProviderError('Approved provider webhook secret is not configured.', 'PROVIDER_SECRET_MISSING', 503);
  }
  return normalized;
}

export function validateProviderWebhookPayload(input: unknown): ProviderWebhookPayload {
  if (!input || typeof input !== 'object') throw new OnboardingProviderError('Webhook payload must be an object.', 'INVALID_PAYLOAD');
  const value = input as Record<string, unknown>;
  const caseId = String(value.caseId ?? '').trim();
  const providerRef = String(value.providerRef ?? '').trim();
  const kind = String(value.kind ?? '') as ProviderVerificationKind;
  const status = String(value.status ?? '') as ProviderVerificationStatus;
  const purpose = String(value.purpose ?? 'onboarding') as ProviderWebhookPayload['purpose'];
  if (!/^oc_[a-f0-9]{20}$/.test(caseId)) throw new OnboardingProviderError('Invalid onboarding case reference.', 'INVALID_CASE_REFERENCE');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{5,199}$/.test(providerRef) || providerRef.includes('://')) throw new OnboardingProviderError('Invalid opaque provider reference.', 'INVALID_PROVIDER_REFERENCE');
  if (!['identity', 'kyb', 'screening'].includes(kind)) throw new OnboardingProviderError('Invalid verification kind.', 'INVALID_KIND');
  if (!['accepted', 'review', 'rejected'].includes(status)) throw new OnboardingProviderError('Invalid verification status.', 'INVALID_STATUS');
  if (!['onboarding', 'rescreen'].includes(purpose)) throw new OnboardingProviderError('Invalid verification purpose.', 'INVALID_PURPOSE');
  if (purpose === 'rescreen' && kind !== 'screening') throw new OnboardingProviderError('Rescreen events must contain screening results.', 'INVALID_RESCREEN_KIND');
  let screenedAt: string | undefined;
  if (value.screenedAt != null) {
    const parsed = new Date(String(value.screenedAt));
    if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > Date.now() + 60_000) throw new OnboardingProviderError('Invalid screening timestamp.', 'INVALID_SCREENING_TIMESTAMP');
    screenedAt = parsed.toISOString();
  }
  let screening: ProviderWebhookPayload['screening'];
  if (kind === 'screening') {
    if (!value.screening || typeof value.screening !== 'object') throw new OnboardingProviderError('Screening results must include sanctions, PEP and adverse-media dispositions.', 'SCREENING_RESULTS_REQUIRED');
    const raw = value.screening as Record<string, unknown>;
    screening = { sanctions: String(raw.sanctions) as ScreeningDisposition, pep: String(raw.pep) as ScreeningDisposition, adverseMedia: String(raw.adverseMedia) as ScreeningDisposition };
    if (Object.values(screening).some(item => !['clear', 'match', 'not_run'].includes(item))) throw new OnboardingProviderError('Invalid screening disposition.', 'INVALID_SCREENING_RESULT');
    if (status === 'accepted' && Object.values(screening).some(item => item !== 'clear')) throw new OnboardingProviderError('Accepted screening events require all dimensions to be clear.', 'SCREENING_NOT_CLEAR');
  }
  return { caseId, providerRef, kind, status, purpose, ...(screenedAt ? { screenedAt } : {}), ...(screening ? { screening } : {}) };
}

export function signProviderWebhook(rawBody: Buffer, eventId: string, timestamp: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(eventId).update('.').update(timestamp).update('.').update(rawBody).digest('hex');
}

export function verifyProviderWebhook(input: { rawBody: Buffer; eventId: string; timestamp: string; signature: string; secret: string; now?: number; toleranceMs?: number }): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(input.eventId)) throw new OnboardingProviderError('Invalid webhook event identifier.', 'INVALID_EVENT_ID');
  const timestampMs = Date.parse(input.timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs((input.now ?? Date.now()) - timestampMs) > (input.toleranceMs ?? 300_000)) throw new OnboardingProviderError('Webhook timestamp is outside the replay window.', 'STALE_WEBHOOK', 401);
  if (!/^[a-f0-9]{64}$/i.test(input.signature)) throw new OnboardingProviderError('Invalid webhook signature.', 'INVALID_SIGNATURE', 401);
  const expected = Buffer.from(signProviderWebhook(input.rawBody, input.eventId, input.timestamp, input.secret), 'hex');
  const received = Buffer.from(input.signature, 'hex');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) throw new OnboardingProviderError('Invalid webhook signature.', 'INVALID_SIGNATURE', 401);
}

type SumsubDigestAlgorithm = 'HMAC_SHA256_HEX' | 'HMAC_SHA512_HEX';

export function verifySumsubWebhook(input: { rawBody: Buffer; signature: string; algorithm: string; secret: string }): void {
  const algorithms: Record<SumsubDigestAlgorithm, 'sha256' | 'sha512'> = {
    HMAC_SHA256_HEX: 'sha256',
    HMAC_SHA512_HEX: 'sha512',
  };
  const algorithm = algorithms[input.algorithm as SumsubDigestAlgorithm];
  if (!algorithm) throw new OnboardingProviderError('Unsupported Sumsub webhook digest algorithm.', 'INVALID_SIGNATURE_ALGORITHM', 401);
  if (input.secret.length < 32) throw new OnboardingProviderError('Approved provider webhook secret is not configured.', 'PROVIDER_SECRET_MISSING', 503);
  const expectedHex = crypto.createHmac(algorithm, input.secret).update(input.rawBody).digest('hex');
  if (!new RegExp(`^[a-f0-9]{${expectedHex.length}}$`, 'i').test(input.signature)) throw new OnboardingProviderError('Invalid webhook signature.', 'INVALID_SIGNATURE', 401);
  const expected = Buffer.from(expectedHex, 'hex');
  const received = Buffer.from(input.signature, 'hex');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) throw new OnboardingProviderError('Invalid webhook signature.', 'INVALID_SIGNATURE', 401);
}

/** One decoded, ready-to-record provider event derived from a Sumsub webhook. */
export type SumsubMappedEvent = { eventId: string; payload: ProviderWebhookPayload };

/**
 * Sumsub verification levels whose successful (GREEN) review attests to a completed
 * sanctions / PEP / adverse-media screening. Only for these levels do we translate a
 * review into a screening event; otherwise we make no screening assertion and the
 * approval gate stays closed (fail-closed).
 */
const SUMSUB_AML_SCREENING_LEVEL = /aml|sanction|pep|screen|watchlist/i;

/**
 * Derive the screening dispositions from a Sumsub review.
 * - GREEN  -> all clear.
 * - RED    -> map Sumsub reject labels onto sanctions / PEP / adverse-media.
 *             A rejection unrelated to those dimensions returns null (no screening claim).
 */
function deriveSumsubScreening(
  accepted: boolean,
  reviewResult: Record<string, unknown>,
): { sanctions: ScreeningDisposition; pep: ScreeningDisposition; adverseMedia: ScreeningDisposition } | null {
  if (accepted) return { sanctions: 'clear', pep: 'clear', adverseMedia: 'clear' };
  const labels = Array.isArray(reviewResult.rejectLabels)
    ? reviewResult.rejectLabels.map(label => String(label).toUpperCase())
    : [];
  const sanctions: ScreeningDisposition = labels.some(l => l.includes('SANCTION') || l.includes('WATCHLIST')) ? 'match' : 'clear';
  const pep: ScreeningDisposition = labels.some(l => l.includes('PEP')) ? 'match' : 'clear';
  const adverseMedia: ScreeningDisposition = labels.some(l => l.includes('ADVERSE')) ? 'match' : 'clear';
  if (sanctions === 'clear' && pep === 'clear' && adverseMedia === 'clear') return null;
  return { sanctions, pep, adverseMedia };
}

/**
 * Map a signed Sumsub `applicantReviewed` webhook into the provider events the onboarding
 * store understands.
 *
 * A completed review yields an identity (or KYB, for company applicants) event, and — when
 * the verification level performed AML screening — a screening event. This is what allows
 * `assertProviderVerificationComplete` (which requires BOTH an accepted identity/KYB event
 * AND an accepted, all-clear screening event) to pass on a genuine Sumsub approval.
 */
export function mapSumsubWebhookPayload(input: unknown): { events: SumsubMappedEvent[] } {
  if (!input || typeof input !== 'object') throw new OnboardingProviderError('Sumsub webhook payload must be an object.', 'INVALID_PAYLOAD');
  const value = input as Record<string, unknown>;
  const externalUserId = String(value.externalUserId ?? '').trim();
  const applicantId = String(value.applicantId ?? '').trim();
  const applicantType = String(value.applicantType ?? 'individual').trim().toLowerCase();
  const levelName = String(value.levelName ?? '').trim();
  const correlationId = String(value.correlationId ?? '').trim();
  const type = String(value.type ?? '').trim();
  const reviewStatus = String(value.reviewStatus ?? '').trim();
  const reviewResult = value.reviewResult && typeof value.reviewResult === 'object' ? value.reviewResult as Record<string, unknown> : {};
  const reviewAnswer = String(reviewResult.reviewAnswer ?? '').trim().toUpperCase();

  if (!/^oc_[a-f0-9]{20}$/.test(externalUserId)) throw new OnboardingProviderError('Sumsub externalUserId must be the onboarding case reference.', 'INVALID_CASE_REFERENCE');
  if (!/^[a-f0-9]{20,64}$/i.test(applicantId)) throw new OnboardingProviderError('Invalid Sumsub applicant reference.', 'INVALID_PROVIDER_REFERENCE');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(correlationId)) throw new OnboardingProviderError('Invalid Sumsub correlation identifier.', 'INVALID_EVENT_ID');
  if (type !== 'applicantReviewed' || reviewStatus !== 'completed') throw new OnboardingProviderError('Unsupported Sumsub webhook event.', 'UNSUPPORTED_PROVIDER_EVENT');
  if (!['GREEN', 'RED'].includes(reviewAnswer)) throw new OnboardingProviderError('Sumsub review result requires manual review.', 'PROVIDER_REVIEW_REQUIRED', 202);

  const accepted = reviewAnswer === 'GREEN';
  const providerRef = `sumsub:${applicantId}`;
  const identityKind: ProviderVerificationKind = applicantType === 'company' ? 'kyb' : 'identity';

  const events: SumsubMappedEvent[] = [
    {
      eventId: correlationId,
      payload: validateProviderWebhookPayload({
        caseId: externalUserId,
        providerRef,
        kind: identityKind,
        status: accepted ? 'accepted' : 'rejected',
        purpose: 'onboarding',
      }),
    },
  ];

  if (SUMSUB_AML_SCREENING_LEVEL.test(levelName)) {
    const screening = deriveSumsubScreening(accepted, reviewResult);
    if (screening) {
      events.push({
        eventId: `${correlationId}:screening`,
        payload: validateProviderWebhookPayload({
          caseId: externalUserId,
          providerRef,
          kind: 'screening',
          status: accepted ? 'accepted' : 'review',
          purpose: 'onboarding',
          screening,
        }),
      });
    }
  }

  return { events };
}
