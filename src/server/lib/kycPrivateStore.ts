import crypto from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/db.js';
import { kycDocuments, kycProfiles, onboardingCases, onboardingEvidence, onboardingEvents } from '../db/schema.js';
import { documentNumberLast4, encryptKycField, maskDocumentNumber } from './kycFieldEncryption.js';
import {
  createKycObjectKey,
  deletePrivateKycObject,
  downloadPrivateKycObject,
  sanitizeOriginalFilename,
  uploadPrivateKycObject,
  validateAndSanitizeKycDocument,
  type KycMimeType,
} from './kycStorage.js';

export const KYC_DOCUMENT_KINDS = ['identity_front', 'identity_back', 'proof_of_address', 'additional'] as const;
export type KycDocumentKind = typeof KYC_DOCUMENT_KINDS[number];

const profileSchema = z.object({
  legalName: z.string().trim().min(2).max(150),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nationality: z.string().trim().min(2).max(80),
  residenceCountry: z.string().trim().min(2).max(80),
  addressLine1: z.string().trim().min(5).max(200),
  addressLine2: z.string().trim().max(200).optional().default(''),
  city: z.string().trim().min(2).max(100),
  region: z.string().trim().max(100).optional().default(''),
  postalCode: z.string().trim().min(2).max(20),
  documentType: z.enum(['passport', 'national_id', 'drivers_license', 'residence_permit']),
  issuingCountry: z.string().trim().min(2).max(80),
  documentNumber: z.string().trim().min(4).max(64),
  documentIssuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  documentExpiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  informationCertified: z.literal(true),
  privacyAcknowledged: z.literal(true),
});

export type KycProfileInput = z.infer<typeof profileSchema>;

function validateDates(input: KycProfileInput): void {
  const birth = new Date(`${input.dateOfBirth}T00:00:00Z`);
  const expiry = new Date(`${input.documentExpiresAt}T00:00:00Z`);
  const issued = input.documentIssuedAt ? new Date(`${input.documentIssuedAt}T00:00:00Z`) : null;
  const now = new Date();
  if (!Number.isFinite(birth.getTime()) || birth >= now) throw new Error('Date of birth must be a valid date in the past.');
  if (!Number.isFinite(expiry.getTime()) || expiry <= now) throw new Error('Identity document must not be expired.');
  if (issued && (!Number.isFinite(issued.getTime()) || issued >= expiry)) throw new Error('Document issue date must be before its expiry date.');
}

export async function saveKycProfile(userId: string, caseId: string, body: unknown) {
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) throw Object.assign(new Error('Complete every required identity and residency field.'), { code: 'INVALID_KYC_PROFILE' });
  validateDates(parsed.data);
  const db = getDb();
  const [record] = await db.select().from(onboardingCases).where(and(eq(onboardingCases.id, caseId), eq(onboardingCases.userId, userId))).limit(1);
  if (!record) throw Object.assign(new Error('Onboarding case not found.'), { code: 'NOT_FOUND' });
  if (!['draft', 'needs_info'].includes(record.status)) throw Object.assign(new Error('The submitted profile is locked during review.'), { code: 'CASE_LOCKED' });
  const encryptedNumber = encryptKycField(parsed.data.documentNumber);
  const last4 = documentNumberLast4(parsed.data.documentNumber);
  const now = new Date();
  const existing = await db.select({ version: kycProfiles.version }).from(kycProfiles).where(eq(kycProfiles.userId, userId)).limit(1);
  const values = {
    caseId,
    legalName: parsed.data.legalName,
    dateOfBirth: parsed.data.dateOfBirth,
    nationality: parsed.data.nationality,
    residenceCountry: parsed.data.residenceCountry,
    addressLine1: parsed.data.addressLine1,
    addressLine2: parsed.data.addressLine2 || null,
    city: parsed.data.city,
    region: parsed.data.region || null,
    postalCode: parsed.data.postalCode,
    documentType: parsed.data.documentType,
    issuingCountry: parsed.data.issuingCountry,
    documentNumberCiphertext: encryptedNumber,
    documentNumberLast4: last4,
    documentIssuedAt: parsed.data.documentIssuedAt || null,
    documentExpiresAt: parsed.data.documentExpiresAt,
    informationCertified: true,
    privacyAcknowledged: true,
    version: (existing[0]?.version ?? 0) + 1,
    updatedAt: now,
  };
  const result = await db.transaction(async tx => {
    const rows = existing[0]
      ? await tx.update(kycProfiles).set(values).where(eq(kycProfiles.userId, userId)).returning()
      : await tx.insert(kycProfiles).values({ userId, ...values, createdAt: now }).returning();
    await tx.update(onboardingCases).set({ version: record.version + 1, lastEditedBy: userId, updatedAt: now })
      .where(and(eq(onboardingCases.id, caseId), eq(onboardingCases.version, record.version)));
    await tx.insert(onboardingEvents).values({
      id: `oe_${crypto.randomBytes(10).toString('hex')}`, caseId, userId,
      action: 'kyc_profile_saved', actorId: userId, actorType: 'customer',
      fromStatus: record.status, toStatus: record.status,
      details: { profileVersion: values.version }, createdAt: now,
    });
    return rows[0];
  });
  return publicProfile(result);
}

function publicProfile(profile: typeof kycProfiles.$inferSelect | undefined) {
  if (!profile) return null;
  return {
    legalName: profile.legalName,
    dateOfBirth: profile.dateOfBirth,
    nationality: profile.nationality,
    residenceCountry: profile.residenceCountry,
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2 ?? '',
    city: profile.city,
    region: profile.region ?? '',
    postalCode: profile.postalCode,
    documentType: profile.documentType,
    issuingCountry: profile.issuingCountry,
    documentNumberMasked: maskDocumentNumber(profile.documentNumberLast4),
    documentIssuedAt: profile.documentIssuedAt ?? '',
    documentExpiresAt: profile.documentExpiresAt,
    informationCertified: profile.informationCertified,
    privacyAcknowledged: profile.privacyAcknowledged,
    version: profile.version,
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function getKycProfile(userId: string) {
  const rows = await getDb().select().from(kycProfiles).where(eq(kycProfiles.userId, userId)).limit(1);
  return publicProfile(rows[0]);
}

function publicDocument(document: typeof kycDocuments.$inferSelect) {
  return {
    id: document.id,
    kind: document.kind,
    mimeType: document.mimeType,
    byteSize: document.byteSize,
    sha256: document.sha256,
    state: document.state,
    version: document.version,
    originalName: document.originalName,
    createdAt: document.createdAt.toISOString(),
  };
}

export async function listKycDocuments(caseId: string, includeHistory = false) {
  const rows = await getDb().select().from(kycDocuments).where(eq(kycDocuments.caseId, caseId)).orderBy(desc(kycDocuments.createdAt));
  return rows.filter(row => includeHistory || row.state === 'active').map(publicDocument);
}

export async function storeKycDocument(input: {
  userId: string;
  caseId: string;
  kind: KycDocumentKind;
  contentType: string;
  originalName: string;
  bytes: Buffer;
}) {
  const sanitized = await validateAndSanitizeKycDocument(input.bytes, input.contentType);
  const db = getDb();
  const [record] = await db.select().from(onboardingCases).where(and(eq(onboardingCases.id, input.caseId), eq(onboardingCases.userId, input.userId))).limit(1);
  if (!record) throw Object.assign(new Error('Onboarding case not found.'), { code: 'NOT_FOUND' });
  if (!['draft', 'needs_info'].includes(record.status)) throw Object.assign(new Error('Evidence cannot be edited after submission.'), { code: 'CASE_LOCKED' });
  const [current] = await db.select().from(kycDocuments).where(and(
    eq(kycDocuments.caseId, input.caseId), eq(kycDocuments.kind, input.kind), eq(kycDocuments.state, 'active'),
  )).limit(1);
  const id = `kd_${crypto.randomBytes(12).toString('hex')}`;
  const storageKey = createKycObjectKey(input.caseId, id, sanitized.mimeType);
  const sha256 = crypto.createHash('sha256').update(sanitized.bytes).digest('hex');
  const version = (current?.version ?? 0) + 1;
  const originalName = sanitizeOriginalFilename(input.originalName, sanitized.mimeType);
  await uploadPrivateKycObject(storageKey, sanitized.bytes, sanitized.mimeType);
  try {
    const created = await db.transaction(async tx => {
      const now = new Date();
      const inserted = await tx.insert(kycDocuments).values({
        id, caseId: input.caseId, userId: input.userId, kind: input.kind,
        storageKey, mimeType: sanitized.mimeType, byteSize: sanitized.bytes.length,
        sha256, state: current ? 'rejected' : 'active', version, originalName, createdAt: now,
      }).returning();
      if (current) {
        await tx.update(kycDocuments).set({ state: 'superseded', supersededAt: now, supersededBy: id })
          .where(and(eq(kycDocuments.id, current.id), eq(kycDocuments.state, 'active')));
        await tx.update(kycDocuments).set({ state: 'active' }).where(eq(kycDocuments.id, id));
      }
      await tx.insert(onboardingEvidence).values({
        id: `ev_${crypto.randomBytes(10).toString('hex')}`, caseId: input.caseId,
        kind: input.kind === 'proof_of_address' ? 'address' : 'identity',
        referenceType: 'internal', reference: `document:${id}`, sha256,
        createdBy: input.userId, lastEditedBy: input.userId, createdAt: now, updatedAt: now,
      });
      await tx.update(onboardingCases).set({ version: record.version + 1, lastEditedBy: input.userId, updatedAt: now })
        .where(and(eq(onboardingCases.id, input.caseId), eq(onboardingCases.version, record.version)));
      await tx.insert(onboardingEvents).values({
        id: `oe_${crypto.randomBytes(10).toString('hex')}`, caseId: input.caseId, userId: input.userId,
        action: current ? 'kyc_document_replaced' : 'kyc_document_uploaded', actorId: input.userId, actorType: 'customer',
        fromStatus: record.status, toStatus: record.status,
        details: { documentId: id, kind: input.kind, mimeType: sanitized.mimeType, byteSize: sanitized.bytes.length, sha256, version }, createdAt: now,
      });
      return inserted[0];
    });
    return publicDocument({ ...created, state: 'active' });
  } catch (error) {
    await deletePrivateKycObject(storageKey).catch(() => undefined);
    throw error;
  }
}

export async function getKycDocumentForAdmin(documentId: string) {
  const rows = await getDb().select().from(kycDocuments).where(eq(kycDocuments.id, documentId)).limit(1);
  const record = rows[0];
  if (!record) return null;
  return { metadata: publicDocument(record), userId: record.userId, caseId: record.caseId, bytes: await downloadPrivateKycObject(record.storageKey) };
}

export async function getKycCompletion(userId: string, caseId: string) {
  const [profileRows, documents] = await Promise.all([
    getDb().select().from(kycProfiles).where(and(eq(kycProfiles.userId, userId), eq(kycProfiles.caseId, caseId))).limit(1),
    getDb().select().from(kycDocuments).where(and(eq(kycDocuments.caseId, caseId), eq(kycDocuments.state, 'active'))),
  ]);
  const profile = profileRows[0];
  const kinds = new Set(documents.map(document => document.kind));
  const requiredKinds: KycDocumentKind[] = ['identity_front', 'proof_of_address'];
  if (profile && profile.documentType !== 'passport') requiredKinds.push('identity_back');
  return {
    profileComplete: Boolean(profile?.informationCertified && profile?.privacyAcknowledged),
    requiredKinds,
    documentKinds: [...kinds] as KycDocumentKind[],
    missingKinds: requiredKinds.filter(kind => !kinds.has(kind)),
  };
}

export type StoredKycDocument = Awaited<ReturnType<typeof getKycDocumentForAdmin>>;
export type StoredKycMimeType = KycMimeType;
