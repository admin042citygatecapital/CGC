import crypto from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { beneficialOwnerRecords, legalEntityProfiles, legalEntityVerificationEvents } from '../db/schema.js';
import type { BeneficialOwnerRecordRow, LegalEntityProfileRow } from '../db/schema.js';
import { appendAuditEntry } from './auditLog.js';
import { assertApprovedProvider } from './onboardingProviderWebhook.js';
import { SPONSOR_PACKAGE_ID } from './sponsorReadinessCatalogue.js';
import type { AdminRole } from './sessionStore.js';

export type VerificationStatus = 'draft'|'submitted'|'verified'|'rejected'|'expired';
export interface EntityActor { id: string; email: string; role: AdminRole; ip?: string }
export interface EntityInput { legalName: string; jurisdiction: string; registrationNumber: string; legalForm: string; registryUrl: string; registrySha256?: string|null; expiresAt?: string|null }
export interface OwnerInput { id?: string; controllerRef: string; ownershipBand: 'none'|'0-25'|'25-50'|'50-75'|'75-100'; controlNature: string; providerCode: string; providerRef: string; evidenceSha256?: string|null; expiresAt?: string|null }

export class LegalEntityVerificationError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400) { super(message); }
}

function requireAccess(actor: EntityActor) {
  if (!['SUPER_ADMIN','COMPLIANCE_ADMIN'].includes(actor.role)) throw new LegalEntityVerificationError('Compliance administrator access is required.', 'FORBIDDEN', 403);
  if (!isDatabaseConfigured()) throw new LegalEntityVerificationError('Legal entity verification requires PostgreSQL.', 'DATABASE_REQUIRED', 503);
}
function clean(value: unknown, label: string, min: number, max: number) {
  const result = String(value ?? '').trim();
  if (result.length < min || result.length > max) throw new LegalEntityVerificationError(`${label} must be ${min}-${max} characters.`, 'VALIDATION_ERROR');
  return result;
}
function opaque(value: unknown, label: string) {
  const result = clean(value, label, 3, 200);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(result) || result.includes('://')) throw new LegalEntityVerificationError(`${label} must be an opaque reference.`, 'VALIDATION_ERROR');
  return result;
}
function hash(value?: string|null) {
  const result = value?.trim().toLowerCase() || null;
  if (result && !/^[a-f0-9]{64}$/.test(result)) throw new LegalEntityVerificationError('Evidence SHA-256 must be 64 lowercase hexadecimal characters.', 'VALIDATION_ERROR');
  return result;
}
function date(value?: string|null) {
  if (!value) return null;
  const result = new Date(value);
  if (!Number.isFinite(result.getTime()) || result <= new Date()) throw new LegalEntityVerificationError('Expiry must be a valid future date.', 'VALIDATION_ERROR');
  return result;
}
function registryUrl(value: unknown) {
  const result = clean(value, 'registryUrl', 10, 500); let parsed: URL;
  try { parsed = new URL(result); } catch { throw new LegalEntityVerificationError('Registry URL is invalid.', 'VALIDATION_ERROR'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new LegalEntityVerificationError('Registry URL must use HTTPS and contain no credentials.', 'VALIDATION_ERROR');
  const approvedHosts = String(process.env.APPROVED_ENTITY_REGISTRY_HOSTS ?? 'find-and-update.company-information.service.gov.uk').split(',').map(host => host.trim().toLowerCase()).filter(Boolean);
  if (!approvedHosts.includes(parsed.hostname.toLowerCase())) throw new LegalEntityVerificationError('Registry URL host is not approved.', 'REGISTRY_HOST_NOT_APPROVED', 403);
  return result;
}
function effective<T extends { status: string; expiresAt: Date|null }>(record: T, now = new Date()): T & { effectiveStatus: VerificationStatus } {
  return { ...record, effectiveStatus: record.status === 'verified' && record.expiresAt && record.expiresAt <= now ? 'expired' : record.status as VerificationStatus };
}
export function assertLegalEntityMakerChecker(record: { submittedBy: string|null; lastEditedBy: string }, reviewerId: string) {
  if (record.submittedBy === reviewerId || record.lastEditedBy === reviewerId) throw new LegalEntityVerificationError('Maker-checker prevents the submitter or last editor from reviewing this record.', 'MAKER_CHECKER_VIOLATION', 409);
}
async function event(entityId: string, actor: EntityActor, action: string, ownerRecordId?: string, fromStatus?: string|null, toStatus?: string|null, details: Record<string, unknown> = {}) {
  await getDb().insert(legalEntityVerificationEvents).values({ id: `lev_${crypto.randomUUID()}`, entityId, ownerRecordId: ownerRecordId ?? null, action, actorId: actor.id, actorRole: actor.role, fromStatus: fromStatus ?? null, toStatus: toStatus ?? null, details });
  await appendAuditEntry({ adminId: actor.id, adminEmail: actor.email, action: `legal_entity_${action}`, target: ownerRecordId ? 'beneficial-owner' : 'legal-entity', targetId: ownerRecordId ?? entityId, details, ip: actor.ip });
}

export function assessLegalEntityVerification(entity: (LegalEntityProfileRow & { effectiveStatus?: VerificationStatus })|null, owners: Array<BeneficialOwnerRecordRow & { effectiveStatus?: VerificationStatus }>) {
  const active = owners.filter(owner => owner.active);
  const entityVerified = entity?.effectiveStatus === 'verified';
  const ownersVerified = active.length > 0 && active.every(owner => owner.effectiveStatus === 'verified');
  return { entityVerified, ownersVerified, verified: entityVerified && ownersVerified, activeOwnerCount: active.length };
}

export async function getLegalEntityVerification(actor: EntityActor) {
  requireAccess(actor);
  const entities = await getDb().select().from(legalEntityProfiles).where(eq(legalEntityProfiles.packageId, SPONSOR_PACKAGE_ID)).limit(1);
  const entity = entities[0] ? effective(entities[0]) : null;
  const [owners, events] = entity ? await Promise.all([
    getDb().select().from(beneficialOwnerRecords).where(eq(beneficialOwnerRecords.entityId, entity.id)).orderBy(asc(beneficialOwnerRecords.createdAt)),
    getDb().select().from(legalEntityVerificationEvents).where(eq(legalEntityVerificationEvents.entityId, entity.id)).orderBy(asc(legalEntityVerificationEvents.createdAt)),
  ]) : [[], []];
  const enrichedOwners = owners.map(owner => effective(owner));
  return { entity, owners: enrichedOwners, events, assessment: assessLegalEntityVerification(entity, enrichedOwners), evidenceMetadataOnly: true, financialOperationsLocked: true };
}

export async function saveLegalEntity(input: EntityInput, actor: EntityActor) {
  requireAccess(actor); const now = new Date();
  const value = { legalName: clean(input.legalName, 'legalName', 2, 200), jurisdiction: clean(input.jurisdiction, 'jurisdiction', 2, 100), registrationNumber: opaque(input.registrationNumber, 'registrationNumber'), legalForm: clean(input.legalForm, 'legalForm', 2, 100), registryUrl: registryUrl(input.registryUrl), registrySha256: hash(input.registrySha256), expiresAt: date(input.expiresAt) };
  const existing = await getDb().select().from(legalEntityProfiles).where(eq(legalEntityProfiles.packageId, SPONSOR_PACKAGE_ID)).limit(1);
  if (existing[0]) {
    const rows = await getDb().update(legalEntityProfiles).set({ ...value, version: existing[0].version + 1, status: 'draft', lastEditedBy: actor.id, submittedBy: null, submittedAt: null, reviewedBy: null, reviewedAt: null, reviewNote: null, updatedAt: now }).where(eq(legalEntityProfiles.id, existing[0].id)).returning();
    await event(rows[0].id, actor, 'profile_edited', undefined, existing[0].status, 'draft', { version: rows[0].version }); return rows[0];
  }
  const id = `le_${crypto.randomUUID()}`;
  const rows = await getDb().insert(legalEntityProfiles).values({ id, packageId: SPONSOR_PACKAGE_ID, ...value, createdBy: actor.id, lastEditedBy: actor.id, createdAt: now, updatedAt: now }).returning();
  await event(id, actor, 'profile_created', undefined, null, 'draft'); return rows[0];
}

export async function saveBeneficialOwner(input: OwnerInput, actor: EntityActor) {
  requireAccess(actor); const entities = await getDb().select().from(legalEntityProfiles).where(eq(legalEntityProfiles.packageId, SPONSOR_PACKAGE_ID)).limit(1); const entity = entities[0];
  if (!entity) throw new LegalEntityVerificationError('Create the legal entity profile first.', 'ENTITY_REQUIRED', 409);
  const providerCode = assertApprovedProvider(opaque(input.providerCode, 'providerCode').toLowerCase());
  const value = { controllerRef: opaque(input.controllerRef, 'controllerRef'), ownershipBand: input.ownershipBand, controlNature: clean(input.controlNature, 'controlNature', 3, 300), providerCode, providerRef: opaque(input.providerRef, 'providerRef'), evidenceSha256: hash(input.evidenceSha256), expiresAt: date(input.expiresAt) };
  if (!['none','0-25','25-50','50-75','75-100'].includes(value.ownershipBand)) throw new LegalEntityVerificationError('Invalid ownership band.', 'VALIDATION_ERROR');
  const now = new Date();
  if (input.id) {
    const existing = await getDb().select().from(beneficialOwnerRecords).where(and(eq(beneficialOwnerRecords.id, input.id), eq(beneficialOwnerRecords.entityId, entity.id))).limit(1);
    if (!existing[0]) throw new LegalEntityVerificationError('Owner record not found.', 'NOT_FOUND', 404);
    const rows = await getDb().update(beneficialOwnerRecords).set({ ...value, status: 'draft', active: true, lastEditedBy: actor.id, submittedBy: null, submittedAt: null, reviewedBy: null, reviewedAt: null, reviewNote: null, updatedAt: now }).where(eq(beneficialOwnerRecords.id, input.id)).returning();
    await event(entity.id, actor, 'owner_edited', rows[0].id, existing[0].status, 'draft'); return rows[0];
  }
  const id = `bor_${crypto.randomUUID()}`;
  const rows = await getDb().insert(beneficialOwnerRecords).values({ id, entityId: entity.id, ...value, createdBy: actor.id, lastEditedBy: actor.id, createdAt: now, updatedAt: now }).returning();
  await event(entity.id, actor, 'owner_created', id, null, 'draft'); return rows[0];
}

export async function submitBeneficialOwner(id: string, actor: EntityActor) {
  requireAccess(actor); const rows = await getDb().select().from(beneficialOwnerRecords).where(eq(beneficialOwnerRecords.id, id)).limit(1); const current = rows[0];
  if (!current) throw new LegalEntityVerificationError('Owner record not found.', 'NOT_FOUND', 404);
  if (!['draft','rejected','expired'].includes(effective(current).effectiveStatus)) throw new LegalEntityVerificationError('Owner record cannot be submitted from its current state.', 'INVALID_STATE', 409);
  const now = new Date(); const updated = await getDb().update(beneficialOwnerRecords).set({ status: 'submitted', submittedBy: actor.id, submittedAt: now, lastEditedBy: actor.id, updatedAt: now }).where(eq(beneficialOwnerRecords.id, id)).returning();
  await event(current.entityId, actor, 'owner_submitted', id, current.status, 'submitted'); return updated[0];
}

export async function reviewBeneficialOwner(id: string, decision: 'verified'|'rejected', note: string, actor: EntityActor) {
  requireAccess(actor); const rows = await getDb().select().from(beneficialOwnerRecords).where(eq(beneficialOwnerRecords.id, id)).limit(1); const current = rows[0];
  if (!current) throw new LegalEntityVerificationError('Owner record not found.', 'NOT_FOUND', 404);
  if (current.status !== 'submitted') throw new LegalEntityVerificationError('Only submitted owner records may be reviewed.', 'INVALID_STATE', 409); assertLegalEntityMakerChecker(current, actor.id);
  const reviewNote = clean(note, 'reviewNote', 10, 1000); const now = new Date(); const updated = await getDb().update(beneficialOwnerRecords).set({ status: decision, reviewedBy: actor.id, reviewedAt: now, reviewNote, updatedAt: now }).where(eq(beneficialOwnerRecords.id, id)).returning();
  await event(current.entityId, actor, 'owner_reviewed', id, 'submitted', decision, { reviewNote }); return updated[0];
}

export async function submitLegalEntity(actor: EntityActor) {
  requireAccess(actor); const snapshot = await getLegalEntityVerification(actor); if (!snapshot.entity) throw new LegalEntityVerificationError('Legal entity profile not found.', 'NOT_FOUND', 404);
  if (!['draft','rejected','expired'].includes(snapshot.entity.effectiveStatus)) throw new LegalEntityVerificationError('Entity cannot be submitted from its current state.', 'INVALID_STATE', 409);
  if (!snapshot.assessment.ownersVerified) throw new LegalEntityVerificationError('All active beneficial owners/controllers must be independently verified first.', 'OWNERS_NOT_VERIFIED', 409);
  const now = new Date(); const updated = await getDb().update(legalEntityProfiles).set({ status: 'submitted', submittedBy: actor.id, submittedAt: now, lastEditedBy: actor.id, updatedAt: now }).where(eq(legalEntityProfiles.id, snapshot.entity.id)).returning();
  await event(snapshot.entity.id, actor, 'profile_submitted', undefined, snapshot.entity.status, 'submitted'); return updated[0];
}

export async function reviewLegalEntity(decision: 'verified'|'rejected', note: string, actor: EntityActor) {
  requireAccess(actor); const snapshot = await getLegalEntityVerification(actor); const current = snapshot.entity;
  if (!current) throw new LegalEntityVerificationError('Legal entity profile not found.', 'NOT_FOUND', 404);
  if (current.status !== 'submitted') throw new LegalEntityVerificationError('Only a submitted entity may be reviewed.', 'INVALID_STATE', 409); assertLegalEntityMakerChecker(current, actor.id);
  if (decision === 'verified' && !snapshot.assessment.ownersVerified) throw new LegalEntityVerificationError('Current verified ownership evidence is required.', 'OWNERS_NOT_VERIFIED', 409);
  const reviewNote = clean(note, 'reviewNote', 10, 1000); const now = new Date(); const updated = await getDb().update(legalEntityProfiles).set({ status: decision, reviewedBy: actor.id, reviewedAt: now, reviewNote, updatedAt: now }).where(eq(legalEntityProfiles.id, current.id)).returning();
  await event(current.id, actor, 'profile_reviewed', undefined, 'submitted', decision, { reviewNote }); return updated[0];
}
