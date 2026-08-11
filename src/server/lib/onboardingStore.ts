import crypto from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/db.js';
import { onboardingCases, onboardingEvidence, onboardingEvents } from '../db/schema.js';
import { getOnboardingProviderSummary } from './onboardingProviderStore.js';

export type OnboardingStatus = 'draft' | 'submitted' | 'under_review' | 'needs_info' | 'approved' | 'rejected' | 'expired';
export type OnboardingCaseType = 'individual' | 'business';
export type EvidenceKind = 'identity' | 'address' | 'selfie' | 'company' | 'ownership' | 'authority' | 'screening';
export type EvidenceReferenceType = 'provider' | 'controlled_url' | 'internal';

const REVIEWABLE = new Set<OnboardingStatus>(['submitted', 'under_review', 'needs_info']);
const DECISIONS = new Set<OnboardingStatus>(['under_review', 'needs_info', 'approved', 'rejected']);

export function validateEvidenceReference(input: {
  referenceType: EvidenceReferenceType; reference: string; sha256?: string; issuedAt?: string; expiresAt?: string;
}): string | null {
  const reference = input.reference.trim();
  if (reference.length < 3 || reference.length > 500) return 'Evidence reference must be between 3 and 500 characters.';
  if (input.referenceType === 'provider' && (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$/.test(reference) || reference.includes('://'))) {
    return 'Provider evidence must be an opaque reference, not a URL or document content.';
  }
  if (input.referenceType === 'controlled_url') {
    try {
      const url = new URL(reference);
      if (url.protocol !== 'https:' || url.username || url.password) return 'Controlled evidence URLs must use HTTPS and contain no credentials.';
    } catch { return 'Controlled evidence URL is invalid.'; }
  }
  if (input.sha256 && !/^[a-f0-9]{64}$/.test(input.sha256)) return 'SHA-256 must be 64 lowercase hexadecimal characters.';
  const issued = input.issuedAt ? new Date(input.issuedAt) : undefined;
  const expires = input.expiresAt ? new Date(input.expiresAt) : undefined;
  if (issued && !Number.isFinite(issued.getTime())) return 'Issue date is invalid.';
  if (expires && !Number.isFinite(expires.getTime())) return 'Expiry date is invalid.';
  if (issued && expires && expires <= issued) return 'Expiry date must be after issue date.';
  return null;
}

export function assertMakerChecker(caseRecord: { submittedBy: string | null; lastEditedBy: string }, reviewerId: string): void {
  if (caseRecord.submittedBy === reviewerId || caseRecord.lastEditedBy === reviewerId) {
    throw Object.assign(new Error('The submitting or last-editing administrator cannot review this case.'), { code: 'MAKER_CHECKER_REQUIRED' });
  }
}

async function appendEvent(input: {
  caseId: string; userId: string; action: string; actorId: string; actorType: 'customer' | 'admin' | 'system';
  fromStatus?: string | null; toStatus?: string | null; details?: Record<string, unknown>;
}) {
  await getDb().insert(onboardingEvents).values({
    id: `oe_${crypto.randomBytes(10).toString('hex')}`,
    caseId: input.caseId, userId: input.userId, action: input.action, actorId: input.actorId,
    actorType: input.actorType, fromStatus: input.fromStatus ?? null, toStatus: input.toStatus ?? null,
    details: input.details ?? {}, createdAt: new Date(),
  });
}

export async function getOrCreateOnboardingCase(userId: string, caseType: OnboardingCaseType, actorId: string) {
  const db = getDb();
  const existing = await db.select().from(onboardingCases)
    .where(and(eq(onboardingCases.userId, userId), inArray(onboardingCases.status, ['draft', 'submitted', 'under_review', 'needs_info', 'approved'])))
    .orderBy(desc(onboardingCases.updatedAt)).limit(1);
  if (existing[0]) return existing[0];
  const rows = await db.insert(onboardingCases).values({
    id: `oc_${crypto.randomBytes(10).toString('hex')}`, userId, caseType, status: 'draft', version: 1,
    lastEditedBy: actorId, createdAt: new Date(), updatedAt: new Date(),
  }).returning();
  await appendEvent({ caseId: rows[0].id, userId, action: 'case_created', actorId, actorType: actorId === userId ? 'customer' : 'admin', toStatus: 'draft' });
  return rows[0];
}

export async function addOnboardingEvidence(input: {
  caseId: string; userId: string; actorId: string; actorType: 'customer' | 'admin'; kind: EvidenceKind;
  referenceType: EvidenceReferenceType; reference: string; sha256?: string; issuedAt?: string; expiresAt?: string;
}) {
  const db = getDb();
  const cases = await db.select().from(onboardingCases).where(eq(onboardingCases.id, input.caseId)).limit(1);
  const current = cases[0];
  if (!current || current.userId !== input.userId) throw Object.assign(new Error('Onboarding case not found.'), { code: 'NOT_FOUND' });
  if (!['draft', 'needs_info'].includes(current.status)) throw Object.assign(new Error('Evidence cannot be edited after submission.'), { code: 'CASE_LOCKED' });
  const validation = validateEvidenceReference(input);
  if (validation) throw Object.assign(new Error(validation), { code: 'INVALID_EVIDENCE' });
  const evidenceCount = await db.select({ id: onboardingEvidence.id }).from(onboardingEvidence).where(eq(onboardingEvidence.caseId, input.caseId));
  if (evidenceCount.length >= 20) throw Object.assign(new Error('A case may contain at most 20 evidence references.'), { code: 'EVIDENCE_LIMIT' });
  const rows = await db.insert(onboardingEvidence).values({
    id: `ev_${crypto.randomBytes(10).toString('hex')}`, caseId: input.caseId, kind: input.kind,
    referenceType: input.referenceType, reference: input.reference.trim(), sha256: input.sha256 ?? null,
    issuedAt: input.issuedAt ? new Date(input.issuedAt) : null, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    createdBy: input.actorId, lastEditedBy: input.actorId, createdAt: new Date(), updatedAt: new Date(),
  }).returning();
  await db.update(onboardingCases).set({ lastEditedBy: input.actorId, version: current.version + 1, updatedAt: new Date() }).where(eq(onboardingCases.id, input.caseId));
  await appendEvent({ caseId: current.id, userId: current.userId, action: 'evidence_added', actorId: input.actorId, actorType: input.actorType, details: { evidenceId: rows[0].id, kind: input.kind, referenceType: input.referenceType } });
  return rows[0];
}

export async function submitOnboardingCase(caseId: string, userId: string, actorId: string, actorType: 'customer' | 'admin') {
  const db = getDb();
  const rows = await db.select().from(onboardingCases).where(eq(onboardingCases.id, caseId)).limit(1);
  const current = rows[0];
  if (!current || current.userId !== userId) throw Object.assign(new Error('Onboarding case not found.'), { code: 'NOT_FOUND' });
  if (!['draft', 'needs_info'].includes(current.status)) throw Object.assign(new Error('Case cannot be submitted from its current status.'), { code: 'INVALID_TRANSITION' });
  const evidence = await db.select({ id: onboardingEvidence.id }).from(onboardingEvidence).where(eq(onboardingEvidence.caseId, caseId));
  if (evidence.length === 0) throw Object.assign(new Error('At least one secure evidence reference is required.'), { code: 'EVIDENCE_REQUIRED' });
  const now = new Date();
  const updated = await db.update(onboardingCases).set({ status: 'submitted', submittedBy: actorId, submittedAt: now, lastEditedBy: actorId, updatedAt: now }).where(eq(onboardingCases.id, caseId)).returning();
  await appendEvent({ caseId, userId, action: 'case_submitted', actorId, actorType, fromStatus: current.status, toStatus: 'submitted', details: { version: current.version, evidenceCount: evidence.length } });
  return updated[0];
}

export async function reviewOnboardingCase(input: { caseId: string; reviewerId: string; decision: OnboardingStatus; reason: string }) {
  if (!DECISIONS.has(input.decision)) throw Object.assign(new Error('Invalid review decision.'), { code: 'INVALID_DECISION' });
  if (input.reason.trim().length < 10 || input.reason.length > 1000) throw Object.assign(new Error('Review rationale must be between 10 and 1000 characters.'), { code: 'INVALID_REASON' });
  const db = getDb();
  const rows = await db.select().from(onboardingCases).where(eq(onboardingCases.id, input.caseId)).limit(1);
  const current = rows[0];
  if (!current) throw Object.assign(new Error('Onboarding case not found.'), { code: 'NOT_FOUND' });
  if (!REVIEWABLE.has(current.status)) throw Object.assign(new Error('Case is not reviewable in its current status.'), { code: 'INVALID_TRANSITION' });
  assertMakerChecker(current, input.reviewerId);
  const now = new Date();
  const updated = await db.update(onboardingCases).set({ status: input.decision, reviewedBy: input.reviewerId, reviewedAt: now, reviewReason: input.reason.trim(), updatedAt: now }).where(eq(onboardingCases.id, input.caseId)).returning();
  await appendEvent({ caseId: current.id, userId: current.userId, action: 'case_reviewed', actorId: input.reviewerId, actorType: 'admin', fromStatus: current.status, toStatus: input.decision, details: { reason: input.reason.trim(), version: current.version } });
  return updated[0];
}

export async function getOnboardingCaseBundle(caseId: string) {
  const db = getDb();
  const cases = await db.select().from(onboardingCases).where(eq(onboardingCases.id, caseId)).limit(1);
  if (!cases[0]) return null;
  const [evidence, events, providerVerifications] = await Promise.all([
    db.select().from(onboardingEvidence).where(eq(onboardingEvidence.caseId, caseId)).orderBy(onboardingEvidence.createdAt),
    db.select().from(onboardingEvents).where(eq(onboardingEvents.caseId, caseId)).orderBy(onboardingEvents.createdAt),
    getOnboardingProviderSummary(caseId),
  ]);
  return { case: cases[0], evidence, events, providerVerifications };
}

export async function listOnboardingCases(status?: OnboardingStatus) {
  const db = getDb();
  return db.select().from(onboardingCases).where(status ? eq(onboardingCases.status, status) : undefined).orderBy(desc(onboardingCases.updatedAt));
}

export async function getLatestOnboardingCaseForUser(userId: string) {
  const rows = await getDb().select().from(onboardingCases)
    .where(eq(onboardingCases.userId, userId)).orderBy(desc(onboardingCases.updatedAt)).limit(1);
  return rows[0] ?? null;
}
