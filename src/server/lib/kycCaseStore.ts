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
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { accountApplications, kycCases, kycCaseEvents, kycCaseDocuments } from '../db/schema.js';
import { escapeLikePattern } from './inputValidator.js';
import { validateAndSanitizeKycDocument, uploadPrivateKycObject, deletePrivateKycObject, createKycObjectKey } from './kycStorage.js';

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
  }).onConflictDoNothing().returning();
  if (!row) {
    const [again] = await db.select().from(kycCases).where(eq(kycCases.applicationId, input.applicationId)).limit(1);
    return again as KycCaseRow;
  }
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

export async function listCasesForAdmin(filter: { status?: string; accountType?: string; q?: string; limit?: number }): Promise<Array<KycCaseRow & { customerEmail: string | null; customerName: string | null; applicationReference: string | null }>> {
  if (!isDatabaseConfigured()) return [];
  const conditions = [];
  if (filter.status) conditions.push(eq(kycCases.status, filter.status));
  if (filter.accountType) conditions.push(eq(kycCases.accountType, filter.accountType));
  const search = filter.q?.trim();
  if (search) {
    const pattern = `%${escapeLikePattern(search)}%`;
    conditions.push(or(
      ilike(accountApplications.email, pattern),
      ilike(accountApplications.reference, pattern),
      ilike(accountApplications.firstName, pattern),
      ilike(accountApplications.lastName, pattern),
    ));
  }
  const rows = await getDb().select({
    kycCase: kycCases,
    customerEmail: accountApplications.email,
    customerFirstName: accountApplications.firstName,
    customerLastName: accountApplications.lastName,
    applicationReference: accountApplications.reference,
  }).from(kycCases)
    .leftJoin(accountApplications, eq(kycCases.applicationId, accountApplications.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(kycCases.updatedAt)).limit(Math.min(filter.limit ?? 100, 200));
  return rows.map((row) => {
    const c = row.kycCase as unknown as KycCaseRow;
    const name = [row.customerFirstName, row.customerLastName].filter(Boolean).join(' ');
    return {
      ...c,
      customerEmail: (row.customerEmail as string | null) ?? null,
      customerName: name || null,
      applicationReference: (row.applicationReference as string | null) ?? null,
    };
  });
}

export interface KycDecisionInput {
  caseId: string; decision: 'APPROVED' | 'REJECTED' | 'NEEDS_INFORMATION' | 'EXPIRED' | 'UNDER_REVIEW';
  reason: string; reviewerId: string; reviewerRole: string;
}

const CASE_DECISION_SOURCES = ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED'];

export async function decideCase(input: KycDecisionInput): Promise<KycCaseRow | null> {
  if (!isDatabaseConfigured()) return null;
  const [current] = await getDb().select().from(kycCases).where(eq(kycCases.id, input.caseId)).limit(1);
  if (!current) return null;
  if (!CASE_DECISION_SOURCES.includes((current as { status: string }).status)) return null;
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

/** Case detail for the review panel: case, linked application summary, documents, events. */
export async function getCaseWithApplication(caseId: string): Promise<{
  kycCase: KycCaseRow; application: {
    id: string; reference: string | null; email: string; firstName: string; lastName: string;
    accountType: string; selectedPlan: string | null; status: string; completionPct: number;
    informationRequest: string | null; decisionReason: string | null;
  } | null;
} | null> {
  if (!isDatabaseConfigured()) return null;
  const [kycCase] = await getDb().select().from(kycCases).where(eq(kycCases.id, caseId)).limit(1);
  if (!kycCase) return null;
  const caseRow = kycCase as KycCaseRow;
  const [application] = await getDb().select({
    id: accountApplications.id, reference: accountApplications.reference, email: accountApplications.email,
    firstName: accountApplications.firstName, lastName: accountApplications.lastName,
    accountType: accountApplications.accountType, selectedPlan: accountApplications.selectedPlan,
    status: accountApplications.status, completionPct: accountApplications.completionPct,
    informationRequest: accountApplications.informationRequest, decisionReason: accountApplications.decisionReason,
  }).from(accountApplications).where(eq(accountApplications.id, caseRow.applicationId)).limit(1);
  return {
    kycCase: caseRow,
    application: (application as {
      id: string; reference: string | null; email: string; firstName: string; lastName: string;
      accountType: string; selectedPlan: string | null; status: string; completionPct: number;
      informationRequest: string | null; decisionReason: string | null;
    } | undefined) ?? null,
  };
}

/** Internal reviewer note. Content stays in the case event trail, never in central logs. */
export async function addCaseNote(input: {
  caseId: string; actor: string; actorRole: string | null; note: string;
}): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const [existing] = await getDb().select().from(kycCases).where(eq(kycCases.id, input.caseId)).limit(1);
  if (!existing) return false;
  await event(input.caseId, input.actor, input.actorRole, 'KYC_NOTE_ADDED', { note: input.note });
  return true;
}

/** Assign (or re-assign) the reviewing administrator. */
export async function assignReviewer(input: {
  caseId: string; reviewerId: string; actor: string; actorRole: string | null;
}): Promise<KycCaseRow | null> {
  if (!isDatabaseConfigured()) return null;
  const [row] = await getDb().update(kycCases).set({
    reviewerId: input.reviewerId, updatedAt: new Date(),
  }).where(eq(kycCases.id, input.caseId)).returning();
  if (!row) return null;
  await event(input.caseId, input.actor, input.actorRole, 'REVIEWER_ASSIGNED', { reviewerId: input.reviewerId });
  return row as KycCaseRow;
}

/** Server-side document metadata including the private storage path. Never returned to clients. */
export async function getCaseDocument(caseId: string, documentId: string): Promise<{
  id: string; caseId: string; documentType: string; issuingCountry: string | null;
  storagePath: string; mimeType: string; originalName: string | null; createdAt: Date;
} | null> {
  if (!isDatabaseConfigured()) return null;
  const [row] = await getDb().select().from(kycCaseDocuments)
    .where(and(eq(kycCaseDocuments.id, documentId), eq(kycCaseDocuments.caseId, caseId)))
    .limit(1);
  if (!row) return null;
  const r = row as { id: string; caseId: string; documentType: string; issuingCountry: string | null; storagePath: string; mimeType: string; originalName: string | null; createdAt: Date };
  return r;
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
  if (!isDatabaseConfigured()) return { ok: false, error: 'Database offline.' };
  const documentId = crypto.randomUUID();
  const key = createKycObjectKey(input.caseId, documentId, sanitized.mimeType as never);
  await uploadPrivateKycObject(key, sanitized.bytes, sanitized.mimeType as never);
  try {
    await getDb().insert(kycCaseDocuments).values({
      id: documentId, caseId: input.caseId, documentType: input.documentType,
      issuingCountry: input.issuingCountry, storagePath: key, mimeType: sanitized.mimeType,
      byteSize: sanitized.bytes.length, originalName: input.file.name.slice(0, 120), uploadedBy: input.uploadedBy,
    });
  } catch (error) {
    // Do not leave an orphaned blob with no metadata row.
    await deletePrivateKycObject(key).catch(() => {});
    throw error;
  }
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