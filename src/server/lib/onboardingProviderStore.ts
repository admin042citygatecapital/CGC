import crypto from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { onboardingCases, onboardingEvidence, onboardingEvents, onboardingProviderEvents } from '../db/schema.js';
import type { ProviderWebhookPayload } from './onboardingProviderWebhook.js';
import { OnboardingProviderError } from './onboardingProviderWebhook.js';

export interface RecordedProviderEvent extends ProviderWebhookPayload {
  eventId: string;
  providerCode: string;
  payloadSha256: string;
}

export function assessProviderVerification(events: Array<{ kind: 'identity' | 'kyb' | 'screening'; status: 'accepted' | 'review' | 'rejected'; screening: { sanctions: string; pep: string; adverseMedia: string } | null }>, caseType: 'individual' | 'business') {
  const latest = new Map<string, typeof events[number]>();
  for (const event of events) latest.set(event.kind, event);
  const identity = latest.get(caseType === 'business' ? 'kyb' : 'identity');
  const screening = latest.get('screening');
  const identityAccepted = identity?.status === 'accepted';
  const screeningClear = screening?.status === 'accepted' && !!screening.screening && Object.values(screening.screening).every(value => value === 'clear');
  return { identityAccepted, screeningClear, approvable: identityAccepted && screeningClear };
}

export async function recordOnboardingProviderEvent(input: RecordedProviderEvent) {
  if (!isDatabaseConfigured()) throw new OnboardingProviderError('Provider verification requires PostgreSQL.', 'DATABASE_REQUIRED', 503);
  const db = getDb();
  const cases = await db.select().from(onboardingCases).where(eq(onboardingCases.id, input.caseId)).limit(1);
  const current = cases[0];
  if (!current) throw new OnboardingProviderError('Onboarding case was not found.', 'CASE_NOT_FOUND', 404);
  if (['approved', 'rejected', 'expired'].includes(current.status)) throw new OnboardingProviderError('A finalised onboarding case cannot accept provider events.', 'CASE_FINALISED', 409);
  const duplicate = await db.select({ id: onboardingProviderEvents.id }).from(onboardingProviderEvents).where(eq(onboardingProviderEvents.eventId, input.eventId)).limit(1);
  if (duplicate[0]) throw new OnboardingProviderError('Webhook event was already processed.', 'EVENT_REPLAYED', 409);

  const id = `ope_${crypto.randomBytes(12).toString('hex')}`;
  const now = new Date();
  await db.transaction(async tx => {
    await tx.insert(onboardingProviderEvents).values({
      id, eventId: input.eventId, providerCode: input.providerCode, caseId: input.caseId,
      providerRef: input.providerRef, kind: input.kind, status: input.status,
      screening: input.screening ?? null, payloadSha256: input.payloadSha256, receivedAt: now,
    });
    if (input.status === 'accepted') {
      const evidenceKind = input.kind === 'kyb' ? 'company' : input.kind === 'screening' ? 'screening' : 'identity';
      await tx.insert(onboardingEvidence).values({
        id: `ev_${crypto.randomBytes(10).toString('hex')}`, caseId: input.caseId, kind: evidenceKind,
        referenceType: 'provider', reference: `${input.providerCode}:${input.providerRef}`,
        createdBy: `provider:${input.providerCode}`, lastEditedBy: `provider:${input.providerCode}`, createdAt: now, updatedAt: now,
      });
    }
    await tx.insert(onboardingEvents).values({
      id: `oe_${crypto.randomBytes(10).toString('hex')}`, caseId: input.caseId, userId: current.userId,
      action: 'provider_verification_received', actorId: `provider:${input.providerCode}`, actorType: 'system',
      fromStatus: current.status, toStatus: current.status,
      details: { providerCode: input.providerCode, providerEventId: id, kind: input.kind, status: input.status }, createdAt: now,
    });
    await tx.update(onboardingCases).set({ version: current.version + 1, lastEditedBy: `provider:${input.providerCode}`, updatedAt: now }).where(eq(onboardingCases.id, current.id));
  });
  return { id, accepted: input.status === 'accepted' };
}

export async function getOnboardingProviderSummary(caseId: string) {
  const events = await getDb().select().from(onboardingProviderEvents).where(eq(onboardingProviderEvents.caseId, caseId)).orderBy(asc(onboardingProviderEvents.receivedAt));
  const latest = new Map<string, typeof events[number]>();
  for (const event of events) latest.set(event.kind, event);
  const byKind = Object.fromEntries(latest);
  const screening = byKind.screening;
  return {
    events, latest: byKind,
    checks: {
      identityAccepted: byKind.identity?.status === 'accepted',
      kybAccepted: byKind.kyb?.status === 'accepted',
      screeningClear: screening?.status === 'accepted' && !!screening.screening && Object.values(screening.screening).every(value => value === 'clear'),
    },
  };
}

export async function assertProviderVerificationComplete(caseId: string, caseType: 'individual' | 'business'): Promise<void> {
  const summary = await getOnboardingProviderSummary(caseId);
  const assessment = assessProviderVerification(summary.events, caseType);
  if (!assessment.identityAccepted) throw new OnboardingProviderError(`${caseType === 'business' ? 'KYB' : 'Identity'} verification from an approved provider is required.`, 'PROVIDER_IDENTITY_REQUIRED', 409);
  if (!assessment.screeningClear) {
    throw new OnboardingProviderError('Clear sanctions, PEP and adverse-media screening from an approved provider is required.', 'PROVIDER_SCREENING_REQUIRED', 409);
  }
}
