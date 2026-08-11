import crypto from 'node:crypto';
import { and, asc, eq, lt } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { beneficialOwnerRecords, legalEntityProfiles, sponsorEvidence, sponsorEvidenceEvents, sponsorPackages } from '../db/schema.js';
import type { SponsorEvidenceRow } from '../db/schema.js';
import { appendAuditEntry } from './auditLog.js';
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
  return evidence.status === 'approved' && evidence.expiresAt && evidence.expiresAt <= now ? 'expired' : evidence.status;
}

export function assertMakerChecker(evidence: Pick<SponsorEvidenceRow, 'submittedBy' | 'lastEditedBy'>, reviewerId: string): void {
  if (evidence.submittedBy === reviewerId || evidence.lastEditedBy === reviewerId) {
    throw new SponsorReadinessError('Maker-checker prevents the submitter or last editor from reviewing this evidence.', 'MAKER_CHECKER_VIOLATION', 409);
  }
}

function assertCategoryRole(controlKey: string, role: AdminRole): void {
  const control = findSponsorControl(controlKey);
  if (!control) throw new SponsorReadinessError('Unknown sponsor control.', 'UNKNOWN_CONTROL');
  if (!canManageCategory(role, control.category)) throw new SponsorReadinessError('Your role does not own this control category.', 'CATEGORY_FORBIDDEN', 403);
}

async function ensurePackage(): Promise<void> {
  await getDb().insert(sponsorPackages).values({
    id: SPONSOR_PACKAGE_ID, version: SPONSOR_PACKAGE_VERSION,
    jurisdiction: PRODUCT_PROFILE.jurisdiction, legalEntityState: 'unverified',
  }).onConflictDoNothing();
}

async function audit(actor: SponsorActor, action: string, targetId?: string, details?: Record<string, unknown>): Promise<void> {
  await appendAuditEntry({ adminId: actor.id, adminEmail: actor.email, action, target: 'sponsor-readiness', targetId, details, ip: actor.ip });
}

export async function getSponsorReadiness(actor?: SponsorActor): Promise<ReturnType<typeof buildSponsorReadinessSnapshot>> {
  requireDatabase();
  await ensurePackage();
  const db = getDb();
  if (actor) {
    const expired = await db.select().from(sponsorEvidence).where(and(
      eq(sponsorEvidence.packageId, SPONSOR_PACKAGE_ID),
      eq(sponsorEvidence.status, 'approved'),
      lt(sponsorEvidence.expiresAt, new Date()),
    ));
    for (const item of expired) {
      await db.update(sponsorEvidence).set({ status: 'expired', updatedAt: new Date() }).where(eq(sponsorEvidence.id, item.id));
      await db.insert(sponsorEvidenceEvents).values({ id: `see_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, evidenceId: item.id, action: 'expired', actorId: actor.id, actorRole: actor.role, fromStatus: 'approved', toStatus: 'expired', details: { expiresAt: item.expiresAt?.toISOString() } });
      await audit(actor, 'sponsor_evidence_expired', item.id, { controlKey: item.controlKey, expiresAt: item.expiresAt?.toISOString() });
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
  const enrichedEvidence = evidence.map(item => ({ ...item, effectiveStatus: effectiveEvidenceStatus(item, now) }));
  const controlRows = SPONSOR_CONTROLS.map(control => {
    const records = enrichedEvidence.filter(item => item.controlKey === control.key);
    const approved = records.some(item => item.effectiveStatus === 'approved');
    return { ...control, status: approved ? 'approved' as const : records[records.length - 1]?.effectiveStatus ?? 'missing' as const, evidence: records };
  });
  const approvedCount = controlRows.filter(control => control.status === 'approved').length;
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
    summary: { total: controlRows.length, approved: approvedCount, outstanding: gaps.length, percent: Math.round((approvedCount / controlRows.length) * 100), fullyReviewed, sponsorSubmissionReady },
    gaps,
    structuredLegalEntity: { entity, owners, verified: legalEntityState === 'verified' },
    financialOperationsLocked: true,
  };
}

export function deriveStructuredLegalEntityState(entity: typeof legalEntityProfiles.$inferSelect|null, owners: Array<typeof beneficialOwnerRecords.$inferSelect>, now = new Date()): 'unverified'|'evidence_pending'|'verified' {
  if (!entity) return 'unverified';
  const entityCurrent = entity.status === 'verified' && (!entity.expiresAt || entity.expiresAt > now);
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
  const value = validateEvidenceInput(input); assertCategoryRole(value.controlKey, actor.role);
  const db = getDb(); const now = new Date();
  let saved: SponsorEvidenceRow;
  if (input.id) {
    const existing = await db.select().from(sponsorEvidence).where(and(eq(sponsorEvidence.id, input.id), eq(sponsorEvidence.packageId, SPONSOR_PACKAGE_ID))).limit(1);
    if (!existing[0]) throw new SponsorReadinessError('Evidence not found.', 'NOT_FOUND', 404);
    assertCategoryRole(existing[0].controlKey, actor.role);
    const rows = await db.update(sponsorEvidence).set({ ...value, status: 'draft', lastEditedBy: actor.id, submittedBy: null, submittedAt: null, reviewedBy: null, reviewedAt: null, reviewNote: null, updatedAt: now }).where(eq(sponsorEvidence.id, input.id)).returning();
    saved = rows[0];
    await db.insert(sponsorEvidenceEvents).values({ id: `sev_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, evidenceId: saved.id, action: 'edited', actorId: actor.id, actorRole: actor.role, fromStatus: existing[0].status, toStatus: 'draft', details: { controlKey: saved.controlKey } });
    await db.update(sponsorPackages).set({ status: 'draft', submittedBy: null, submittedAt: null, reviewedBy: null, reviewedAt: null, reviewNote: null, updatedAt: now }).where(eq(sponsorPackages.id, SPONSOR_PACKAGE_ID));
    await audit(actor, 'sponsor_evidence_edited', saved.id, { controlKey: saved.controlKey });
  } else {
    const id = `sev_${crypto.randomUUID()}`;
    const rows = await db.insert(sponsorEvidence).values({ id, packageId: SPONSOR_PACKAGE_ID, ...value, status: 'draft', createdBy: actor.id, lastEditedBy: actor.id, createdAt: now, updatedAt: now }).returning();
    saved = rows[0];
    await db.insert(sponsorEvidenceEvents).values({ id: `see_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, evidenceId: saved.id, action: 'created', actorId: actor.id, actorRole: actor.role, toStatus: 'draft', details: { controlKey: saved.controlKey } });
    await audit(actor, 'sponsor_evidence_created', saved.id, { controlKey: saved.controlKey });
  }
  return saved;
}

export async function submitSponsorEvidence(id: string, actor: SponsorActor): Promise<SponsorEvidenceRow> {
  requireDatabase(); const db = getDb();
  const rows = await db.select().from(sponsorEvidence).where(and(eq(sponsorEvidence.id, id), eq(sponsorEvidence.packageId, SPONSOR_PACKAGE_ID))).limit(1);
  const current = rows[0]; if (!current) throw new SponsorReadinessError('Evidence not found.', 'NOT_FOUND', 404);
  assertCategoryRole(current.controlKey, actor.role);
  const status = effectiveEvidenceStatus(current);
  if (status !== 'draft' && status !== 'rejected' && status !== 'expired') throw new SponsorReadinessError('Only draft, rejected or expired evidence can be submitted.', 'INVALID_STATE', 409);
  if (!current.sha256) throw new SponsorReadinessError('A SHA-256 digest is required before submission.', 'HASH_REQUIRED');
  const now = new Date();
  const updated = await db.update(sponsorEvidence).set({ status: 'submitted', submittedBy: actor.id, submittedAt: now, reviewedBy: null, reviewedAt: null, reviewNote: null, updatedAt: now }).where(eq(sponsorEvidence.id, id)).returning();
  await db.insert(sponsorEvidenceEvents).values({ id: `see_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, evidenceId: id, action: 'submitted', actorId: actor.id, actorRole: actor.role, fromStatus: status, toStatus: 'submitted', details: {} });
  await audit(actor, 'sponsor_evidence_submitted', id, { controlKey: current.controlKey });
  return updated[0];
}

export async function reviewSponsorEvidence(id: string, decision: 'approved' | 'rejected', note: string, actor: SponsorActor): Promise<SponsorEvidenceRow> {
  requireDatabase(); const db = getDb();
  const rows = await db.select().from(sponsorEvidence).where(and(eq(sponsorEvidence.id, id), eq(sponsorEvidence.packageId, SPONSOR_PACKAGE_ID))).limit(1);
  const current = rows[0]; if (!current) throw new SponsorReadinessError('Evidence not found.', 'NOT_FOUND', 404);
  assertCategoryRole(current.controlKey, actor.role); assertMakerChecker(current, actor.id);
  if (current.status !== 'submitted') throw new SponsorReadinessError('Only submitted evidence may be reviewed.', 'INVALID_STATE', 409);
  const reviewNote = cleanText(note, 'review note', 10, 1000); const now = new Date();
  const updated = await db.update(sponsorEvidence).set({ status: decision, reviewedBy: actor.id, reviewedAt: now, reviewNote, updatedAt: now }).where(eq(sponsorEvidence.id, id)).returning();
  await db.insert(sponsorEvidenceEvents).values({ id: `see_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, evidenceId: id, action: 'reviewed', actorId: actor.id, actorRole: actor.role, fromStatus: 'submitted', toStatus: decision, details: { decision, reviewNote } });
  await audit(actor, `sponsor_evidence_${decision}`, id, { controlKey: current.controlKey });
  return updated[0];
}

export async function submitSponsorPackage(actor: SponsorActor): Promise<void> {
  if (actor.role !== 'SUPER_ADMIN') throw new SponsorReadinessError('Only a super-administrator may submit the package.', 'SUPER_ADMIN_REQUIRED', 403);
  const snapshot = await getSponsorReadiness();
  if (!snapshot.summary.fullyReviewed) throw new SponsorReadinessError('All required controls must have current approved evidence.', 'PACKAGE_INCOMPLETE', 409);
  const now = new Date(); await getDb().update(sponsorPackages).set({ status: 'submitted', submittedBy: actor.id, submittedAt: now, reviewedBy: null, reviewedAt: null, reviewNote: null, updatedAt: now }).where(eq(sponsorPackages.id, SPONSOR_PACKAGE_ID));
  await getDb().insert(sponsorEvidenceEvents).values({ id: `see_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, action: 'package_submitted', actorId: actor.id, actorRole: actor.role, fromStatus: snapshot.package.status, toStatus: 'submitted', details: {} });
  await audit(actor, 'sponsor_package_submitted', SPONSOR_PACKAGE_ID);
}

export async function reviewSponsorPackage(decision: 'approved' | 'rejected', note: string, actor: SponsorActor): Promise<void> {
  if (actor.role !== 'SUPER_ADMIN') throw new SponsorReadinessError('Only a super-administrator may review the package.', 'SUPER_ADMIN_REQUIRED', 403);
  const snapshot = await getSponsorReadiness();
  if (snapshot.package.status !== 'submitted') throw new SponsorReadinessError('Only a submitted package may be reviewed.', 'INVALID_STATE', 409);
  if (snapshot.package.submittedBy === actor.id) throw new SponsorReadinessError('Maker-checker prevents the package submitter from approving it.', 'MAKER_CHECKER_VIOLATION', 409);
  if (decision === 'approved' && !snapshot.summary.fullyReviewed) throw new SponsorReadinessError('The package has outstanding controls.', 'PACKAGE_INCOMPLETE', 409);
  const reviewNote = cleanText(note, 'review note', 10, 1000); const now = new Date();
  await getDb().update(sponsorPackages).set({ status: decision, reviewedBy: actor.id, reviewedAt: now, reviewNote, updatedAt: now }).where(eq(sponsorPackages.id, SPONSOR_PACKAGE_ID));
  await getDb().insert(sponsorEvidenceEvents).values({ id: `see_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, action: 'package_reviewed', actorId: actor.id, actorRole: actor.role, fromStatus: 'submitted', toStatus: decision, details: { decision, reviewNote } });
  await audit(actor, `sponsor_package_${decision}`, SPONSOR_PACKAGE_ID);
}

export async function recordSponsorExport(actor: SponsorActor, ready: boolean): Promise<void> {
  requireDatabase();
  await getDb().insert(sponsorEvidenceEvents).values({ id: `see_${crypto.randomUUID()}`, packageId: SPONSOR_PACKAGE_ID, action: 'exported', actorId: actor.id, actorRole: actor.role, details: { sponsorSubmissionReady: ready } });
  await audit(actor, 'sponsor_package_exported', SPONSOR_PACKAGE_ID, { sponsorSubmissionReady: ready });
}
