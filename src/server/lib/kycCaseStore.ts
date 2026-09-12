/**
 * Per-application KYC case store.
 *
 * A kyc_case is created when an account application is submitted and carries
 * the review lifecycle (SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED/
 * NEEDS_INFORMATION → EXPIRED). KYC approval is deliberately distinct from
 * regulated-service activation. Provider (liveness/IDV) fields only ever hold
 * provider-reported values.
 */
import crypto from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { kycCases, kycCaseEvents, kycCaseDocuments } from '../db/schema.js';
import { validateAndSanitizeKycDocument, uploadPrivateKycObject, createKycObjectKey } from './kycStorage.js';

export interface KycCaseRow {
  id: string; applicationId: string; userId: string | null; accountType: string;
  status: string; riskLevel: string; reviewerId: string | null;
  providerName: string | null; providerStatus: string | null; providerRef: string | null;
  submittedAt: Date | null; reviewedAt: Date | null; reviewReason: string | null;
}

export const KYC_CASE_STATUSES = ['DRAFT', 'EMAIL_VERIFICATION_REQUIRED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'EXPIRED'] as const;
export const DOCUMENT_TYPES = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'RESIDENCE_PERMIT'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

async function event(caseId: string, actor: string, actorRole: string | null, eventName: string, detail: Record<string, unknown> = {}) {
  if (!isDatabaseConfigured()) return;
  await getDb().insert(kycCaseEvents).values({
    id: crypto.randomUUID(), caseId, actor, actorRole, event: eventName, detail,
  });
}

/** Create (or return existing) the KYC case for an application. */
export async function ensureCaseForApplication(input: {
  applicationId: string; userId: string | null; accountType: string; actor: string;
}): Promise<KycCaseRow> {
  const db = getDb();
  const [existing] = await db.select().from(kycCases).where(eq(kycCases.applicationId, input.applicationId)).limit(1);
  if (existing) return existing as KycCaseRow;
  const [row] = await db.insert(kycCases).values({
    id: crypto.randomUUID(), applicationId: input.applicationId, userId: input.userId,
    accountType: input.accountType, status: 'SUBMITTED', submittedAt: new Date(),
  }).returning();
  await event(row.id, input.actor, null, 'KYC_SUBMITTED', { accountType: input.accountType });
  return row as KycCaseRow;
}

export async function getCaseByApplication(applicationId: string): Promise<KycCaseRow | null> {
  if (!isDatabaseConfigured()) return null;
  const [row] = await getDb().select().from(kycCases).where(eq(kycCases.applicationId, applicationId)).limit(1);
  return (row as KycCaseRow) ?? null;
}

export async function listCasesForUser(userId: string): Promise<KycCaseRow[]> {
  if (!isDatabaseConfigured()) return [];
  return getDb().select().from(kycCases).where(eq(kycCases.userId, userId)).orderBy(desc(kycCases.updatedAt)) as unknown as KycCaseRow[];
}

export async function listCasesForAdmin(filter: { status?: string; accountType?: string; limit?: number }): Promise<KycCaseRow[]> {
  if (!isDatabaseConfigured()) return [];
  const conditions = [];
  if (filter.status) conditions.push(eq(kycCases.status, filter.status));
  if (filter.accountType) conditions.push(eq(kycCases.accountType, filter.accountType));
  return getDb().select().from(kycCases)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(kycCases.updatedAt)).limit(Math.min(filter.limit ?? 100, 200)) as unknown as KycCaseRow[];
}

export interface KycDecisionInput {
  caseId: string; decision: 'APPROVED' | 'REJECTED' | 'NEEDS_INFORMATION' | 'EXPIRED' | 'UNDER_REVIEW';
  reason: string; reviewerId: string; reviewerRole: string;
}

export async function decideCase(input: KycDecisionInput): Promise<KycCaseRow | null> {
  if (!isDatabaseConfigured()) return null;
  const [row] = await getDb().update(kycCases).set({
    status: input.decision, reviewReason: input.reason, reviewerId: input.reviewerId,
    reviewedAt: new Date(), updatedAt: new Date(),
  }).where(eq(kycCases.id, input.caseId)).returning();
  await event(input.caseId, input.reviewerId, input.reviewerRole, `KYC_DECISION:${input.decision}`, { reason: input.reason });
  return (row as KycCaseRow) ?? null;
}

/** Record a provider (liveness/IDV) status. Only ever provider-reported. */
export async function recordProviderStatus(input: {
  caseId: string; providerName: string; providerStatus: string; providerRef: string; actor: string;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await getDb().update(kycCases).set({
    providerName: input.providerName, providerStatus: input.providerStatus,
    providerRef: input.providerRef, updatedAt: new Date(),
  }).where(eq(kycCases.id, input.caseId));
  await event(input.caseId, input.actor, null, 'PROVIDER_STATUS_RECORDED', { provider: input.providerName, status: input.providerStatus });
}

/** Validate + store a document in the private bucket; register metadata only. */
export async function addCaseDocument(input: {
  caseId: string; documentType: string; issuingCountry: string | null;
  file: { buffer: Buffer; contentType: string; name: string };
  uploadedBy: string;
}): Promise<{ ok: true; documentId: string } | { ok: false; error: string }> {
  if (!(DOCUMENT_TYPES as readonly string[]).includes(input.documentType)) {
    return { ok: false, error: `documentType must be one of: ${DOCUMENT_TYPES.join(', ')}` };
  }
  let sanitized: { bytes: Buffer; mimeType: string };
  try {
    sanitized = await validateAndSanitizeKycDocument(input.file.buffer, input.file.contentType);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Document rejected.' };
  }
  const documentId = crypto.randomUUID();
  const key = createKycObjectKey(input.caseId, documentId, sanitized.mimeType as never);
  await uploadPrivateKycObject(key, sanitized.bytes, sanitized.mimeType as never);
  if (!isDatabaseConfigured()) return { ok: false, error: 'Database offline.' };
  await getDb().insert(kycCaseDocuments).values({
    id: documentId, caseId: input.caseId, documentType: input.documentType,
    issuingCountry: input.issuingCountry, storagePath: key, mimeType: sanitized.mimeType,
    byteSize: sanitized.bytes.length, originalName: input.file.name.slice(0, 120), uploadedBy: input.uploadedBy,
  });
  await event(input.caseId, input.uploadedBy, null, 'DOCUMENT_UPLOADED', { documentId, documentType: input.documentType });
  return { ok: true, documentId };
}

export async function listCaseDocuments(caseId: string) {
  if (!isDatabaseConfigured()) return [];
  return getDb().select().from(kycCaseDocuments).where(eq(kycCaseDocuments.caseId, caseId)) as never as Array<{
    id: string; documentType: string; issuingCountry: string | null; originalName: string | null; createdAt: Date;
  }>;
}

export async function getCaseDocumentPath(documentId: string): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const [row] = await getDb().select().from(kycCaseDocuments).where(eq(kycCaseDocuments.id, documentId)).limit(1);
  return row ? (row as { storagePath: string }).storagePath : null;
}

export async function listCaseEvents(caseId: string) {
  if (!isDatabaseConfigured()) return [];
  return getDb().select().from(kycCaseEvents).where(eq(kycCaseEvents.caseId, caseId)).orderBy(desc(kycCaseEvents.createdAt)).limit(200) as never as Array<{
    id: string; event: string; actor: string; actorRole: string | null; createdAt: Date;
  }>;
}