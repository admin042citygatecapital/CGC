import crypto from 'node:crypto';
import { and, asc, eq, inArray, lt } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { beneficialOwnerRecords, legalEntityProfiles, sponsorEvidence, sponsorEvidenceEvents, sponsorEvidenceRevisions, sponsorPackages } from '../db/schema.js';
import type { SponsorEvidenceRow } from '../db/schema.js';
import { appendAuditEntry, appendCriticalAudit } from './auditLog.js';
import { EXTERNAL_SPONSOR_EVIDENCE } from './externalSponsorEvidence.js';
import { isIndependentSponsorReviewer } from './independentSponsorReviewer.js';
import {
  PRODUCT_PROFILE, SPONSOR_CONTROLS, SPONSOR_PACKAGE_ID, SPONSOR_PACKAGE_VERSION,
  canManageCategory, findSponsorControl,
} from './sponsorReadinessCatalogue.js';
import type { AdminRole } from './sessionStore.js';

export type EvidenceStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'expired';
export interface SponsorActor { id: string; email: string; role: AdminRole; ip?: string; }
export interface EvidenceInput {
  id?: string;
  controlKey: string;
  title: string;
  referenceType: 'url' | 'internal';
  reference: string;
  sha256?: string | null;
  owner: string;
  issuedAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
}

export class SponsorReadinessError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400) { super(message); }
}

function requireDatabase(): void {
  if (!isDatabaseConfigured()) throw new SponsorReadinessError('Sponsor readiness requires PostgreSQL.', 'DATABASE_REQUIRED', 503);
}

function cleanText(value: unknown, name: string, min: number, max: number): string {
  const text = String(value ?? '').trim();
  if (text.length < min || text.length > max) throw new SponsorReadinessError(`${name} must be ${min}-${max} characters.`, 'VALIDATION_ERROR');
  return text;
}

function parseOptionalDate(value: string | null | undefined, name: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new SponsorReadinessError(`${name} must be a valid date.`, 'VALIDATION_ERROR');
  return parsed;
}

export function validateEvidenceInput(input: EvidenceInput): Omit<EvidenceInput, 'id' | 'issuedAt' | 'expiresAt'> & { issuedAt: Date | null; expiresAt: Date | null } {
  const control = findSponsorControl(cleanText(input.controlKey, 'controlKey', 3, 100));
  if (!control) throw new SponsorReadinessError('Unknown sponsor control.', 'UNKNOWN_CONTROL');
  if (input.referenceType !== 'url' && input.referenceType !== 'internal') throw new SponsorReadinessError('referenceType must be url or internal.', 'VALIDATION_ERROR');
  const reference = cleanText(input.reference, 'reference', 3, 500);
  if (input.referenceType === 'url') {
    let parsed: URL;
    try { parsed = new URL(reference); } catch { throw new SponsorReadinessError('Evidence URL is invalid.', 'VALIDATION_ERROR'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new SponsorReadinessError('Evidence URLs must use HTTPS and contain no credentials.', 'VALIDATION_ERROR');
  } else if (!/^[A-Za-z0-9][A-Za-z0-9._:/ -]{2,499}$/.test(reference)) {
    throw new SponsorReadinessError('Internal reference contains unsupported characters.', 'VALIDATION_ERROR');
  }
  const sha256 = input.sha256?.trim().toLowerCase() || null;
  if (sha256 && !/^[a-f0-9]{64}$/.test(sha256)) throw new SponsorReadinessError('sha256 must be a 64-character hexadecimal digest.', 'VALIDATION_ERROR');
  const issuedAt = parseOptionalDate(input.issuedAt, 'issuedAt');
  const expiresAt = parseOptionalDate(input.expiresAt, 'expiresAt');
  if (issuedAt && expiresAt && expiresAt <= issuedAt) throw new SponsorReadinessError('expiresAt must be after issuedAt.', 'VALIDATION_ERROR');
  return {
    controlKey: control.key,
    title: cleanText(input.title || control.title, 'title', 3, 180),
    referenceType: input.referenceType,
    reference,
    sha256,
    owner: cleanText(input.owner, 'owner', 2, 160),
    issuedAt,
    expiresAt,
    notes: input.notes ? cleanText(input.notes, 'notes', 2, 2000) : null,
  };
}

export function effectiveEvidenceStatus(evidence: Pick<SponsorEvidenceRow, 'status' | 'expiresAt'>, now = new Date()): EvidenceStatus {
  const expirable = evidence.status === 'draft' || evidence.status === 'submitted' || evidence.status === 'approved';
  return expirable && evidence.expiresAt && evidence.expiresAt <= now ? 'expired' : evidence.status;
}

export function assertMakerChecker(evidence: Pick<SponsorEvidenceRow, 'submittedBy' | 'lastEditedBy'>, reviewerId: string): void {
  if (evidence.submittedBy === reviewerId || evidence.lastEditedBy === reviewerId) {
    throw new SponsorReadinessError('Maker-checker prevents the submitter or last editor from reviewing this evidence.', 'MAKER_CHECKER_VIOLATION', 409);
  }
}

export function isEvidenceRevisionApproved(evidence: Pick<SponsorEvidenceRow, 'status' | 'revision' | 'submittedRevision' | 'reviewedRevision'>): boolean {
  return evidence.status === 'approved' && evidence.submittedRevision === evidence.revision && evidence.reviewedRevision === evidence.revision;
}

export function isEvidenceRevisionSubmitted(evidence: Pick<SponsorEvidenceRow, 'revision' | 'submittedRevision'>): boolean {
  return evidence.submittedRevision === evidence.revision;
}

function revisionValues(evidenceId: string, revision: number, value: ReturnType<typeof validateEvidenceInput>, actor: SponsorActor) {
  return {
    id: `ser_${crypto.randomUUID()}`,
    packageId: SPONSOR_PACKAGE_ID,
    evidenceId,
    revision,
    controlKey: value.controlKey,
    title: value.title,
    referenceType: value.referenceType,
    reference: value.reference,
    sha256: value.sha256,
    owner: value.owner,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
    notes: value.notes,
    actorId: actor.id,
    actorRole: actor.role,
  };
}

export function assertSponsorCategoryOwnership(controlKey: string, actor: Pick<SponsorActor, 'id' | 'role'>): void {
  const control = findSponsorControl(controlKey);
  if (!control) throw new SponsorReadinessError('Unknown sponsor control.', 'UNKNOWN_CONTROL');
  if (!canManageCategory(actor.role, control.category)) {
    throw new SponsorReadinessError('Your role does not own this control category.', 'CATEGORY_FORBIDDEN', 403);
  }
}

export function assertSponsorReviewOwnership(controlKey: string, actor: Pick<SponsorActor, 'id' | 'role'>): void {
  if (!findSponsorControl(controlKey)) throw new SponsorReadinessError('Unknown sponsor control.', 'UNKNOWN_CONTROL');
  if (!isIndependentSponsorReviewer(actor)) {
    throw new SponsorReadinessError('Sponsor evidence review requires the separately authenticated independent checker.', 'INDEPENDENT_CHECKER_REQUIRED', 403);
  }
}

async function ensurePackage(): Promise<void> {
  await getDb().insert(sponsorPackages).values({
    id: SPONSOR_PACKAGE_ID, version: SPONSOR_PACKAGE_VERSION,
    jurisdiction: PRODUCT_PROFILE.jurisdiction, legalEntityState: 'unverified',
  }).onConflictDoNothing();
}

async function auditIntent(actor: SponsorActor, action: string, targetId?: string, details?: Record<string, unknown>): Promise<void> {
  await appendCriticalAudit({
    event: action,
    adminId: actor.id,
    email: actor.email,
    ip: actor.ip,
    meta: { target: 'sponsor-readiness', targetId, ...details },
  });
}

async function auditCompletion(actor: SponsorActor, action: string, targetId?: string, details?: Record<string, unknown>): Promise<void> {
  try {
    await appendAuditEntry({ adminId: actor.id, adminEmail: actor.email, action, target: 'sponsor-readiness', targetId, details, ip: actor.ip });
  } catch (error) {
    // The fail-closed intent is already durable, and the sponsor evidence event
    // is the authoritative append-only completion record. Emit an operational
    // alert so central audit replication can be reconciled without repeating
    // the state mutation.
    console.error('[sponsor-readiness] central audit completion write failed', {
      action,
      targetId,
      actorId: actor.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getSponsorReadiness(actor?: SponsorActor): Promise<ReturnType<typeof buildSponsorReadinessSnapshot>> {
  requireDatabase();
  await ensurePackage();
  const db = getDb();
  if (actor) {
    const expired = await db.select().from(sponsorEvidence).where(and(
      eq(sponsorEvidence.packageId, SPONSOR_PACKAGE_ID),
      inArray(sponsorEvidence.status, ['draft', 'submitted', 'approved']),
      lt(sponsorEvidence.expiresAt, new Date()),
    ));
    for (const item of expired) {
      await auditIntent(actor, 'sponsor_evidence_expire_intent', item.id, { controlKey: item.controlKey, expiresAt: item.expiresAt?.toISOString() });
      const changed = await db.transaction(async tx => {
        const updated = await tx.update(sponsorEvidence).set({ status: 'expired', updatedAt: new Date() }).where(and(
          eq(sponsorEvidence.id, item.id),
          eq(sponsorEvidence.status, item.status),
          eq(sponsorEvidence.updatedAt, item.updatedAt),
        )).returning({ id: sponsorEvidence.id });
        if (!updated[0]) return false;
        await tx.insert(sponsorEvidenceEvents).values({ id: `see_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, evidenceId: item.id, action: 'expired', actorId: actor.id, actorRole: actor.role, fromStatus: item.status, toStatus: 'expired', details: { expiresAt: item.expiresAt?.toISOString() } });
        await tx.update(sponsorPackages).set({
          status: 'draft', submittedBy: null, submittedAt: null,
          reviewedBy: null, reviewedAt: null, reviewNote: null,
          updatedAt: new Date(),
        }).where(eq(sponsorPackages.id, SPONSOR_PACKAGE_ID));
        return true;
      });
      if (changed) await auditCompletion(actor, 'sponsor_evidence_expired', item.id, { controlKey: item.controlKey, expiresAt: item.expiresAt?.toISOString() });
    }
  }
  const [packages, evidence, events, entities] = await Promise.all([
    db.select().from(sponsorPackages).where(eq(sponsorPackages.id, SPONSOR_PACKAGE_ID)).limit(1),
    db.select().from(sponsorEvidence).where(eq(sponsorEvidence.packageId, SPONSOR_PACKAGE_ID)).orderBy(asc(sponsorEvidence.createdAt)),
    db.select().from(sponsorEvidenceEvents).where(eq(sponsorEvidenceEvents.packageId, SPONSOR_PACKAGE_ID)).orderBy(asc(sponsorEvidenceEvents.createdAt)),
    db.select().from(legalEntityProfiles).where(eq(legalEntityProfiles.packageId, SPONSOR_PACKAGE_ID)).limit(1),
  ]);
  const owners = entities[0] ? await db.select().from(beneficialOwnerRecords).where(eq(beneficialOwnerRecords.entityId, entities[0].id)) : [];
  return buildSponsorReadinessSnapshot(packages[0], evidence, events, entities[0] ?? null, owners);
}

export function buildSponsorReadinessSnapshot(packageRow: typeof sponsorPackages.$inferSelect, evidence: SponsorEvidenceRow[], events: Array<typeof sponsorEvidenceEvents.$inferSelect>, entity: typeof legalEntityProfiles.$inferSelect|null = null, owners: Array<typeof beneficialOwnerRecords.$inferSelect> = []) {
  const now = new Date();
  const enrichedEvidence = evidence.map(item => {
    const lifecycleStatus = effectiveEvidenceStatus(item, now);
    const revisionMismatch = lifecycleStatus === 'submitted' && !isEvidenceRevisionSubmitted(item);
    const approvalMismatch = lifecycleStatus === 'approved' && !isEvidenceRevisionApproved(item);
    const effectiveStatus = revisionMismatch || approvalMismatch ? 'draft' as const : lifecycleStatus;
    return { ...item, effectiveStatus };
  });
  const controlRows = SPONSOR_CONTROLS.map(control => {
    const records = enrichedEvidence.filter(item => item.controlKey === control.key);
    const approved = records.some(item => item.effectiveStatus === 'approved');
    return { ...control, status: approved ? 'approved' as const : records[records.length - 1]?.effectiveStatus ?? 'missing' as const, evidence: records };
  });
  const approvedCount = controlRows.filter(control => control.status === 'approved').length;
  const lifecycle = controlRows.reduce((counts, control) => {
    counts[control.status] += 1;
    return counts;
  }, { draft: 0, submitted: 0, approved: 0, rejected: 0, expired: 0, missing: 0 } as Record<EvidenceStatus | 'missing', number>);
  const preparedCount = controlRows.length - lifecycle.missing;
  const legalEntityState = deriveStructuredLegalEntityState(entity, owners, now);
  const gaps: Array<{ key: string; title: string; status: string; ownerRole: string }> = controlRows.filter(control => control.required && control.status !== 'approved').map(control => ({ key: control.key, title: control.title, status: control.status, ownerRole: control.ownerRole }));
  if (legalEntityState !== 'verified') gaps.push({ key: 'structured_legal_entity_registry', title: 'Structured legal entity and ownership verification', status: legalEntityState, ownerRole: 'COMPLIANCE_ADMIN' });
  const fullyReviewed = gaps.length === 0;
  const sponsorSubmissionReady = fullyReviewed && packageRow.status === 'approved';
  return {
    package: { ...packageRow, legalEntityState, label: sponsorSubmissionReady ? 'SPONSOR SUBMISSION READY' : 'DRAFT — NOT APPROVED FOR LAUNCH' },
    productProfile: { ...PRODUCT_PROFILE, legalEntityState },
    controls: controlRows,
    evidence: enrichedEvidence,
    events,
    summary: {
      total: controlRows.length,
      prepared: preparedCount,
      preparedPercent: Math.round((preparedCount / controlRows.length) * 100),
      approved: approvedCount,
      outstanding: gaps.length,
      percent: Math.round((approvedCount / controlRows.length) * 100),
      lifecycle,
      fullyReviewed,
      sponsorSubmissionReady,
    },
    gaps,
    structuredLegalEntity: { entity, owners, verified: legalEntityState === 'verified' },
    externalEvidenceRequirements: EXTERNAL_SPONSOR_EVIDENCE.map(requirement => ({
      ...requirement,
      status: controlRows.find(control => control.key === requirement.controlKey)?.status ?? 'missing',
    })),
    financialOperationsLocked: true,
  };
}

export function deriveStructuredLegalEntityState(entity: typeof legalEntityProfiles.$inferSelect|null, owners: Array<typeof beneficialOwnerRecords.$inferSelect>, now = new Date()): 'unverified'|'evidence_pending'|'verified' {
  if (!entity) return 'unverified';
  const authorityComplete = Boolean(entity.registrySha256 && entity.authorityType && entity.authorityReference && entity.authoritySha256 && entity.authorizedOfficerRef && entity.authorityIssuedAt && entity.authorityIssuedAt <= now);
  const entityCurrent = entity.status === 'verified' && authorityComplete && (!entity.expiresAt || entity.expiresAt > now) && (!entity.authorityExpiresAt || entity.authorityExpiresAt > now);
  const active = owners.filter(owner => owner.active);
  const ownersCurrent = active.length > 0 && active.every(owner => owner.status === 'verified' && (!owner.expiresAt || owner.expiresAt > now));
  return entityCurrent && ownersCurrent ? 'verified' : 'evidence_pending';
}

export function deriveLegalEntityState(evidence: Array<Pick<SponsorEvidenceRow, 'controlKey'> & { effectiveStatus?: EvidenceStatus; status?: EvidenceStatus }>): 'unverified' | 'evidence_pending' | 'verified' {
  const approved = (key: string) => evidence.some(item => item.controlKey === key && (item.effectiveStatus ?? item.status) === 'approved');
  if (approved('legal_entity_verified') && approved('beneficial_owners_verified')) return 'verified';
  return evidence.some(item => item.controlKey === 'legal_entity_verified' || item.controlKey === 'beneficial_owners_verified') ? 'evidence_pending' : 'unverified';
}

export async function saveSponsorEvidence(input: EvidenceInput, actor: SponsorActor): Promise<SponsorEvidenceRow> {
  requireDatabase(); await ensurePackage();
  const value = validateEvidenceInput(input); assertSponsorCategoryOwnership(value.controlKey, actor);
  const db = getDb(); const now = new Date();
  let saved: SponsorEvidenceRow;
  if (input.id) {
    const evidenceId = input.id;
    const existing = await db.select().from(sponsorEvidence).where(and(eq(sponsorEvidence.id, evidenceId), eq(sponsorEvidence.packageId, SPONSOR_PACKAGE_ID))).limit(1);
    if (!existing[0]) throw new SponsorReadinessError('Evidence not found.', 'NOT_FOUND', 404);
    assertSponsorCategoryOwnership(existing[0].controlKey, actor);
    await auditIntent(actor, 'sponsor_evidence_edit_intent', evidenceId, { controlKey: value.controlKey, priorStatus: existing[0].status });
    const nextRevision = existing[0].revision + 1;
    saved = await db.transaction(async tx => {
      const rows = await tx.update(sponsorEvidence).set({ ...value, revision: nextRevision, status: 'draft', lastEditedBy: actor.id, submittedBy: null, submittedAt: null, submittedRevision: null, reviewedBy: null, reviewedAt: null, reviewedRevision: null, reviewNote: null, updatedAt: now }).where(and(eq(sponsorEvidence.id, evidenceId), eq(sponsorEvidence.updatedAt, existing[0].updatedAt))).returning();
      if (!rows[0]) throw new SponsorReadinessError('Evidence changed while it was being edited. Reload and try again.', 'CONCURRENT_MODIFICATION', 409);
      const result = rows[0];
      await tx.insert(sponsorEvidenceRevisions).values(revisionValues(result.id, nextRevision, value, actor));
      await tx.insert(sponsorEvidenceEvents).values({ id: `sev_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, evidenceId: result.id, action: 'edited', actorId: actor.id, actorRole: actor.role, fromStatus: existing[0].status, toStatus: 'draft', details: { controlKey: result.controlKey, fromRevision: existing[0].revision, revision: nextRevision } });
      await tx.update(sponsorPackages).set({ status: 'draft', submittedBy: null, submittedAt: null, reviewedBy: null, reviewedAt: null, reviewNote: null, updatedAt: now }).where(eq(sponsorPackages.id, SPONSOR_PACKAGE_ID));
      return result;
    });
    await auditCompletion(actor, 'sponsor_evidence_edited', saved.id, { controlKey: saved.controlKey, revision: saved.revision });
  } else {
    const id = `sev_${crypto.randomUUID()}`;
    await auditIntent(actor, 'sponsor_evidence_create_intent', id, { controlKey: value.controlKey });
    saved = await db.transaction(async tx => {
      const rows = await tx.insert(sponsorEvidence).values({ id, packageId: SPONSOR_PACKAGE_ID, ...value, revision: 1, status: 'draft', createdBy: actor.id, lastEditedBy: actor.id, createdAt: now, updatedAt: now }).returning();
      const result = rows[0];
      await tx.insert(sponsorEvidenceRevisions).values(revisionValues(result.id, 1, value, actor));
      await tx.insert(sponsorEvidenceEvents).values({ id: `see_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, evidenceId: result.id, action: 'created', actorId: actor.id, actorRole: actor.role, toStatus: 'draft', details: { controlKey: result.controlKey, revision: 1 } });
      return result;
    });
    await auditCompletion(actor, 'sponsor_evidence_created', saved.id, { controlKey: saved.controlKey, revision: saved.revision });
  }
  return saved;
}

export async function submitSponsorEvidence(id: string, actor: SponsorActor): Promise<SponsorEvidenceRow> {
  requireDatabase(); const db = getDb();
  const rows = await db.select().from(sponsorEvidence).where(and(eq(sponsorEvidence.id, id), eq(sponsorEvidence.packageId, SPONSOR_PACKAGE_ID))).limit(1);
  const current = rows[0]; if (!current) throw new SponsorReadinessError('Evidence not found.', 'NOT_FOUND', 404);
  assertSponsorCategoryOwnership(current.controlKey, actor);
  const status = effectiveEvidenceStatus(current);
  if (status === 'expired') throw new SponsorReadinessError('Expired evidence must be updated before submission.', 'EVIDENCE_EXPIRED', 409);
  if (status !== 'draft' && status !== 'rejected') throw new SponsorReadinessError('Only draft or rejected evidence can be submitted.', 'INVALID_STATE', 409);
  if (!current.sha256) throw new SponsorReadinessError('A SHA-256 digest is required before submission.', 'HASH_REQUIRED');
  const now = new Date();
  await auditIntent(actor, 'sponsor_evidence_submit_intent', id, { controlKey: current.controlKey, priorStatus: status });
  const updated = await db.transaction(async tx => {
    const result = await tx.update(sponsorEvidence).set({ status: 'submitted', submittedBy: actor.id, submittedAt: now, submittedRevision: current.revision, reviewedBy: null, reviewedAt: null, reviewedRevision: null, reviewNote: null, updatedAt: now }).where(and(eq(sponsorEvidence.id, id), eq(sponsorEvidence.status, current.status), eq(sponsorEvidence.updatedAt, current.updatedAt))).returning();
    if (!result[0]) throw new SponsorReadinessError('Evidence changed before submission. Reload and try again.', 'CONCURRENT_MODIFICATION', 409);
    await tx.insert(sponsorEvidenceEvents).values({ id: `see_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, evidenceId: id, action: 'submitted', actorId: actor.id, actorRole: actor.role, fromStatus: status, toStatus: 'submitted', details: { revision: current.revision } });
    return result;
  });
  await auditCompletion(actor, 'sponsor_evidence_submitted', id, { controlKey: current.controlKey, revision: current.revision });
  return updated[0];
}

export async function reviewSponsorEvidence(id: string, decision: 'approved' | 'rejected', note: string, actor: SponsorActor): Promise<SponsorEvidenceRow> {
  requireDatabase(); const db = getDb();
  const rows = await db.select().from(sponsorEvidence).where(and(eq(sponsorEvidence.id, id), eq(sponsorEvidence.packageId, SPONSOR_PACKAGE_ID))).limit(1);
  const current = rows[0]; if (!current) throw new SponsorReadinessError('Evidence not found.', 'NOT_FOUND', 404);
  assertSponsorReviewOwnership(current.controlKey, actor); assertMakerChecker(current, actor.id);
  const status = effectiveEvidenceStatus(current);
  if (status === 'expired') throw new SponsorReadinessError('Expired evidence cannot be reviewed; the submitter must update and resubmit it.', 'EVIDENCE_EXPIRED', 409);
  if (status !== 'submitted') throw new SponsorReadinessError('Only submitted evidence may be reviewed.', 'INVALID_STATE', 409);
  if (current.submittedRevision !== current.revision) throw new SponsorReadinessError('The submitted revision no longer matches the current evidence. It must be resubmitted.', 'REVISION_MISMATCH', 409);
  const reviewNote = cleanText(note, 'review note', 10, 1000); const now = new Date();
  await auditIntent(actor, `sponsor_evidence_${decision}_intent`, id, { controlKey: current.controlKey, priorStatus: current.status });
  const updated = await db.transaction(async tx => {
    const result = await tx.update(sponsorEvidence).set({ status: decision, reviewedBy: actor.id, reviewedAt: now, reviewedRevision: current.revision, reviewNote, updatedAt: now }).where(and(eq(sponsorEvidence.id, id), eq(sponsorEvidence.status, 'submitted'), eq(sponsorEvidence.updatedAt, current.updatedAt))).returning();
    if (!result[0]) throw new SponsorReadinessError('Evidence changed before review. Reload and try again.', 'CONCURRENT_MODIFICATION', 409);
    await tx.insert(sponsorEvidenceEvents).values({ id: `see_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, evidenceId: id, action: 'reviewed', actorId: actor.id, actorRole: actor.role, fromStatus: 'submitted', toStatus: decision, details: { decision, reviewNote, revision: current.revision } });
    return result;
  });
  await auditCompletion(actor, `sponsor_evidence_${decision}`, id, { controlKey: current.controlKey, revision: current.revision });
  return updated[0];
}

export async function submitSponsorPackage(actor: SponsorActor): Promise<void> {
  if (actor.role !== 'SUPER_ADMIN') throw new SponsorReadinessError('Only a super-administrator may submit the package.', 'SUPER_ADMIN_REQUIRED', 403);
  const snapshot = await getSponsorReadiness();
  if (!snapshot.summary.fullyReviewed) throw new SponsorReadinessError('All required controls must have current approved evidence.', 'PACKAGE_INCOMPLETE', 409);
  if (snapshot.package.status !== 'draft' && snapshot.package.status !== 'rejected') throw new SponsorReadinessError('Only a draft or rejected package may be submitted.', 'INVALID_STATE', 409);
  await auditIntent(actor, 'sponsor_package_submit_intent', SPONSOR_PACKAGE_ID, { priorStatus: snapshot.package.status });
  const now = new Date();
  await getDb().transaction(async tx => {
    const updated = await tx.update(sponsorPackages).set({ status: 'submitted', submittedBy: actor.id, submittedAt: now, reviewedBy: null, reviewedAt: null, reviewNote: null, updatedAt: now }).where(and(eq(sponsorPackages.id, SPONSOR_PACKAGE_ID), eq(sponsorPackages.status, snapshot.package.status), eq(sponsorPackages.updatedAt, snapshot.package.updatedAt))).returning({ id: sponsorPackages.id });
    if (!updated[0]) throw new SponsorReadinessError('The package changed before submission. Reload and try again.', 'CONCURRENT_MODIFICATION', 409);
    await tx.insert(sponsorEvidenceEvents).values({ id: `see_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, action: 'package_submitted', actorId: actor.id, actorRole: actor.role, fromStatus: snapshot.package.status, toStatus: 'submitted', details: {} });
  });
  await auditCompletion(actor, 'sponsor_package_submitted', SPONSOR_PACKAGE_ID);
}

export async function reviewSponsorPackage(decision: 'approved' | 'rejected', note: string, actor: SponsorActor): Promise<void> {
  if (!isIndependentSponsorReviewer(actor)) throw new SponsorReadinessError('An authorised independent checker is required.', 'INDEPENDENT_CHECKER_REQUIRED', 403);
  const snapshot = await getSponsorReadiness();
  if (snapshot.package.status !== 'submitted') throw new SponsorReadinessError('Only a submitted package may be reviewed.', 'INVALID_STATE', 409);
  if (snapshot.package.submittedBy === actor.id) throw new SponsorReadinessError('Maker-checker prevents the package submitter from approving it.', 'MAKER_CHECKER_VIOLATION', 409);
  if (decision === 'approved' && !snapshot.summary.fullyReviewed) throw new SponsorReadinessError('The package has outstanding controls.', 'PACKAGE_INCOMPLETE', 409);
  const reviewNote = cleanText(note, 'review note', 10, 1000); const now = new Date();
  await auditIntent(actor, `sponsor_package_${decision}_intent`, SPONSOR_PACKAGE_ID, { priorStatus: snapshot.package.status });
  await getDb().transaction(async tx => {
    const updated = await tx.update(sponsorPackages).set({ status: decision, reviewedBy: actor.id, reviewedAt: now, reviewNote, updatedAt: now }).where(and(eq(sponsorPackages.id, SPONSOR_PACKAGE_ID), eq(sponsorPackages.status, 'submitted'), eq(sponsorPackages.updatedAt, snapshot.package.updatedAt))).returning({ id: sponsorPackages.id });
    if (!updated[0]) throw new SponsorReadinessError('The package changed before review. Reload and try again.', 'CONCURRENT_MODIFICATION', 409);
    await tx.insert(sponsorEvidenceEvents).values({ id: `see_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, action: 'package_reviewed', actorId: actor.id, actorRole: actor.role, fromStatus: 'submitted', toStatus: decision, details: { decision, reviewNote } });
  });
  await auditCompletion(actor, `sponsor_package_${decision}`, SPONSOR_PACKAGE_ID);
}

export async function recordSponsorExport(actor: SponsorActor, ready: boolean): Promise<void> {
  requireDatabase();
  await auditIntent(actor, 'sponsor_package_export_intent', SPONSOR_PACKAGE_ID, { sponsorSubmissionReady: ready });
  await getDb().insert(sponsorEvidenceEvents).values({ id: `see_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, action: 'exported', actorId: actor.id, actorRole: actor.role, details: { sponsorSubmissionReady: ready } });
  await auditCompletion(actor, 'sponsor_package_exported', SPONSOR_PACKAGE_ID, { sponsorSubmissionReady: ready });
}
