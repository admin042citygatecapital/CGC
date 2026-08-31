import crypto from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { complianceCaseEvents, complianceCases, onboardingCases, onboardingEvidence, onboardingEvents, onboardingProviderEvents, users } from '../db/schema.js';
import type { ProviderWebhookPayload } from './onboardingProviderWebhook.js';
import { OnboardingProviderError } from './onboardingProviderWebhook.js';

export interface RecordedProviderEvent extends ProviderWebhookPayload {
  eventId: string;
  providerCode: string;
  payloadSha256: string;
}

const RESCREEN_INTERVAL_DAYS = 365;

export function deriveScreeningState(input: Pick<RecordedProviderEvent, 'status' | 'screening'>): 'clear' | 'review' | 'match' {
  if (input.status === 'accepted' && input.screening && Object.values(input.screening).every(value => value === 'clear')) return 'clear';
  if (input.screening && Object.values(input.screening).some(value => value === 'match')) return 'match';
  return 'review';
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
  const customerRows = await db.select({ dataClassification: users.dataClassification }).from(users).where(eq(users.id, current.userId)).limit(1);
  if (customerRows[0]?.dataClassification === 'synthetic_test') {
    throw new OnboardingProviderError('Production provider events are blocked for synthetic test customers.', 'SYNTHETIC_PROVIDER_CALL_BLOCKED', 409);
  }
  const approvedRescreen = current.status === 'approved' && input.kind === 'screening' && input.purpose === 'rescreen';
  if (['approved', 'rejected', 'expired'].includes(current.status) && !approvedRescreen) throw new OnboardingProviderError('A finalised onboarding case cannot accept this provider event.', 'CASE_FINALISED', 409);
  if (input.purpose === 'rescreen' && current.status !== 'approved') throw new OnboardingProviderError('Rescreen events require an approved onboarding case.', 'CASE_NOT_APPROVED', 409);
  const duplicate = await db.select({ id: onboardingProviderEvents.id }).from(onboardingProviderEvents).where(eq(onboardingProviderEvents.eventId, input.eventId)).limit(1);
  if (duplicate[0]) throw new OnboardingProviderError('Webhook event was already processed.', 'EVENT_REPLAYED', 409);

  const id = `ope_${crypto.randomBytes(12).toString('hex')}`;
  const now = new Date();
  const screenedAt = input.screenedAt ? new Date(input.screenedAt) : now;
  const state = input.kind === 'screening' ? deriveScreeningState(input) : null;
  const nextScreeningAt = state === 'clear' ? new Date(screenedAt.getTime() + RESCREEN_INTERVAL_DAYS * 86_400_000) : null;
  await db.transaction(async tx => {
    await tx.insert(onboardingProviderEvents).values({
      id, eventId: input.eventId, providerCode: input.providerCode, caseId: input.caseId,
      providerRef: input.providerRef, kind: input.kind, status: input.status,
      purpose: input.purpose, screenedAt: input.kind === 'screening' ? screenedAt : null,
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
      details: { providerCode: input.providerCode, providerEventId: id, kind: input.kind, status: input.status, purpose: input.purpose, screeningState: state }, createdAt: now,
    });
    await tx.update(onboardingCases).set({
      version: current.version + 1, lastEditedBy: `provider:${input.providerCode}`, updatedAt: now,
      ...(state ? { screeningStatus: state, lastScreenedAt: screenedAt, nextScreeningAt } : {}),
    }).where(eq(onboardingCases.id, current.id));
    if (state && state !== 'clear') {
      const caseKind = input.screening?.sanctions === 'match' ? 'sanctions' : 'aml';
      const complianceId = `cc_${crypto.randomBytes(10).toString('hex')}`;
      const summary = `Approved provider ${input.providerCode} returned ${state} during ${input.purpose} screening; human disposition required.`;
      await tx.insert(complianceCases).values({
        id: complianceId, userId: current.userId, kind: caseKind, status: 'open', riskLevel: state === 'match' ? 'high' : 'unrated',
        summary, openedBy: `provider:${input.providerCode}`, lastEditedBy: `provider:${input.providerCode}`, createdAt: now, updatedAt: now,
      });
      await tx.insert(complianceCaseEvents).values({
        id: `cce_${crypto.randomBytes(10).toString('hex')}`, caseId: complianceId, action: 'provider_screening_alert',
        actorId: `provider:${input.providerCode}`, toStatus: 'open', details: { providerEventId: id, purpose: input.purpose, screeningState: state }, createdAt: now,
      });
      await tx.update(users).set({ amlStatus: 'review', updatedAt: now }).where(eq(users.id, current.userId));
    }
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

export async function listOngoingScreeningQueue(now = new Date()) {
  if (!isDatabaseConfigured()) throw new OnboardingProviderError('Screening queue requires PostgreSQL.', 'DATABASE_REQUIRED', 503);
  const rows = await getDb().select().from(onboardingCases).where(eq(onboardingCases.status, 'approved')).orderBy(asc(onboardingCases.nextScreeningAt));
  return rows.map(row => {
    const due = !row.nextScreeningAt || row.nextScreeningAt.getTime() <= now.getTime();
    return {
      caseId: row.id, userId: row.userId, caseType: row.caseType,
      screeningStatus: due && row.screeningStatus === 'clear' ? 'overdue' : row.screeningStatus,
      lastScreenedAt: row.lastScreenedAt, nextScreeningAt: row.nextScreeningAt, due,
    };
  });
}

export async function assertProviderVerificationComplete(caseId: string, caseType: 'individual' | 'business'): Promise<void> {
  const summary = await getOnboardingProviderSummary(caseId);
  const assessment = assessProviderVerification(summary.events, caseType);
  if (!assessment.identityAccepted) throw new OnboardingProviderError(`${caseType === 'business' ? 'KYB' : 'Identity'} verification from an approved provider is required.`, 'PROVIDER_IDENTITY_REQUIRED', 409);
  if (!assessment.screeningClear) {
    throw new OnboardingProviderError('Clear sanctions, PEP and adverse-media screening from an approved provider is required.', 'PROVIDER_SCREENING_REQUIRED', 409);
  }
}
