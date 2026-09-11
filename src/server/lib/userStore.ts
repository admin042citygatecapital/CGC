/**
 * userStore.ts — PostgreSQL-backed user repository.
 *
 * Drop-in replacement for the flat-file JSONL implementation.
 * All exported function signatures are identical to the original.
 *
 * Falls back to flat-file behaviour when DATABASE_URL is not configured,
 * so the app continues to work during the migration transition period.
 */

import crypto from 'node:crypto';
import { and, eq, sql as drizzleSql } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { onboardingCases, onboardingEvents, users } from '../db/schema.js';
import type { User, NewUser } from '../db/schema.js';
import { stripDangerousKeys } from './inputValidator.js';

// ── Re-export types (backward compat) ─────────────────────────────────────────

export type UserStatus = 'pending_verification' | 'pending_kyc' | 'pending_approval' | 'active' | 'suspended' | 'frozen' | 'rejected';
export type KYCStatus  = 'not_submitted' | 'submitted' | 'approved' | 'rejected';
export type AMLStatus  = 'not_screened' | 'pending' | 'cleared' | 'review' | 'blocked';
export type AMLRiskLevel = 'unrated' | 'low' | 'medium' | 'high';

// Map DB row → legacy UserRecord shape (camelCase)
export interface UserRecord {
  id: string;
  email: string;
  name: string;
  phone?: string;
  country?: string;
  status: UserStatus;
  kycStatus: KYCStatus;
  amlStatus: AMLStatus;
  amlRiskLevel: AMLRiskLevel;
  amlReviewedAt?: string;
  amlReviewedBy?: string;
  amlReviewReason?: string;
  amlNextReviewAt?: string;
  emailVerified: boolean;
  emailVerifyToken?: string;
  emailVerifyExpiry?: string;
  passwordHash: string;
  credentialVersion: number;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  loginAttempts: number;
  lastLoginAt?: string;
  lastLoginIp?: string;
  ip?: string;
  balance?: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  bankSwift?: string;
  bankIban?: string;
  walletBtc?: string;
  walletEth?: string;
  walletUsdt?: string;
  walletSol?: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  idType?: string;
  idNumber?: string;
  idDocumentUrl?: string;
  kycSubmittedAt?: string;
  kycApprovedAt?: string;
  kycExpiresAt?: string;
  kycReviewedBy?: string;
  kycReviewReason?: string;
  kycRejectedAt?: string;
  kycRejectionReason?: string;
  selfieUrl?: string;
  sessionToken?: string;
  sessionCreatedAt?: string;
  sessionLastSeenAt?: string;
  sessionExpiresAt?: string;
  sessionCredentialVersion?: number;
  primaryCurrency?: string;
  accountTier?: 'personal' | 'savings' | 'business';
  requestedProduct?: string;
  totpSecret?: string;
  totpEnabled?: boolean;
  totpRecoveryHashes?: string[];
  locale?: string;
  timezone?: string;
  notificationPrefs?: unknown;
  beneficiaries?: unknown;
  trustedDevices?: unknown;
  dataClassification?: string;
  quarantineBatchId?: string;
  quarantinedAt?: string;
}

export type CreateUserInput =
  Omit<UserRecord,
    | 'id' | 'createdAt' | 'updatedAt' | 'loginAttempts' | 'amlStatus' | 'amlRiskLevel'
    | 'credentialVersion' | 'sessionToken' | 'sessionCreatedAt' | 'sessionLastSeenAt'
    | 'sessionExpiresAt' | 'sessionCredentialVersion'>
  & Partial<Pick<UserRecord, 'amlStatus' | 'amlRiskLevel'>>;

/**
 * Nullable credential fields must be cleared explicitly. `undefined` means
 * "leave the persisted value unchanged" in the PostgreSQL mapper, while
 * `null` removes the value in both supported stores.
 */
type ExplicitlyClearableUserField =
  | 'emailVerifyToken'
  | 'emailVerifyExpiry'
  | 'totpSecret'
  | 'totpRecoveryHashes';

export type UserUpdatePatch =
  Partial<Omit<UserRecord, ExplicitlyClearableUserField>>
  & { [K in ExplicitlyClearableUserField]?: UserRecord[K] | null };

// ── DB row → UserRecord ───────────────────────────────────────────────────────

function toRecord(u: User): UserRecord {
  return {
    id:                  u.id,
    email:               u.email,
    name:                u.name,
    phone:               u.phone ?? undefined,
    country:             u.country ?? undefined,
    status:              u.status as UserStatus,
    kycStatus:           u.kycStatus as KYCStatus,
    amlStatus:           u.amlStatus as AMLStatus,
    amlRiskLevel:        u.amlRiskLevel as AMLRiskLevel,
    amlReviewedAt:       u.amlReviewedAt?.toISOString() ?? undefined,
    amlReviewedBy:       u.amlReviewedBy ?? undefined,
    amlReviewReason:     u.amlReviewReason ?? undefined,
    amlNextReviewAt:     u.amlNextReviewAt?.toISOString() ?? undefined,
    emailVerified:       u.emailVerified,
    emailVerifyToken:    u.emailVerifyToken ?? undefined,
    emailVerifyExpiry:   u.emailVerifyExpiry?.toISOString() ?? undefined,
    passwordHash:        u.passwordHash,
    credentialVersion:   u.credentialVersion,
    loginAttempts:       u.loginAttempts,
    lastLoginAt:         u.lastLoginAt?.toISOString() ?? undefined,
    lastLoginIp:         u.lastLoginIp ?? undefined,
    ip:                  u.ip ?? undefined,
    balance:             u.balance ?? 0,
    bankName:            u.bankName ?? undefined,
    bankAccountNumber:   u.bankAccountNumber ?? undefined,
    bankRoutingNumber:   u.bankRoutingNumber ?? undefined,
    bankSwift:           u.bankSwift ?? undefined,
    bankIban:            u.bankIban ?? undefined,
    walletBtc:           u.walletBtc ?? undefined,
    walletEth:           u.walletEth ?? undefined,
    walletUsdt:          u.walletUsdt ?? undefined,
    walletSol:           u.walletSol ?? undefined,
    avatarUrl:           u.avatarUrl ?? undefined,
    dateOfBirth:         u.dateOfBirth ?? undefined,
    address:             u.address ?? undefined,
    city:                u.city ?? undefined,
    postalCode:          u.postalCode ?? undefined,
    idType:              u.idType ?? undefined,
    idNumber:            u.idNumber ?? undefined,
    idDocumentUrl:       u.idDocumentUrl ?? undefined,
    kycSubmittedAt:      u.kycSubmittedAt?.toISOString() ?? undefined,
    kycApprovedAt:       u.kycApprovedAt?.toISOString() ?? undefined,
    kycExpiresAt:        u.kycExpiresAt?.toISOString() ?? undefined,
    kycReviewedBy:       u.kycReviewedBy ?? undefined,
    kycReviewReason:     u.kycReviewReason ?? undefined,
    kycRejectedAt:       u.kycRejectedAt?.toISOString() ?? undefined,
    kycRejectionReason:  u.kycRejectionReason ?? undefined,
    selfieUrl:           u.selfieUrl ?? undefined,
    approvedAt:          u.approvedAt?.toISOString() ?? undefined,
    approvedBy:          u.approvedBy ?? undefined,
    rejectedAt:          u.rejectedAt?.toISOString() ?? undefined,
    rejectedBy:          u.rejectedBy ?? undefined,
    rejectionReason:     u.rejectionReason ?? undefined,
    primaryCurrency:     u.primaryCurrency ?? 'USD',
    accountTier:         (u.accountTier ?? 'personal') as 'personal' | 'savings' | 'business',
    requestedProduct:    u.requestedProduct ?? undefined,
    totpSecret:          u.totpSecret ?? undefined,
    totpEnabled:         u.totpEnabled ?? false,
    totpRecoveryHashes:  u.totpRecoveryHashes ?? undefined,
    locale:              u.locale ?? undefined,
    timezone:            u.timezone ?? undefined,
    notificationPrefs:   u.notificationPrefs ?? undefined,
    beneficiaries:       u.beneficiaries ?? undefined,
    trustedDevices:      u.trustedDevices ?? undefined,
    dataClassification:  u.dataClassification,
    quarantineBatchId:   u.quarantineBatchId ?? undefined,
    quarantinedAt:       u.quarantinedAt?.toISOString() ?? undefined,
    createdAt:           u.createdAt.toISOString(),
    updatedAt:           u.updatedAt.toISOString(),
  };
}

// ── Flat-file fallback ────────────────────────────────────────────────────────
// When DATABASE_URL is not set, fall back to the original flat-file implementation.
// This ensures the app keeps working during the migration transition.

let _flatFile: typeof import('./userStore.flatfile.js') | null = null;

async function getFlatFile() {
  if (!_flatFile) {
    _flatFile = await import('./userStore.flatfile.js');
  }
  return _flatFile;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function loadAllUsers(): Promise<UserRecord[]> {
  if (!isDatabaseConfigured()) {
    const ff = await getFlatFile();
    return ff.loadAllUsers();
  }
  const db = getDb();
  const rows = await db.select().from(users).orderBy(users.createdAt);
  return rows.map(toRecord);
}

export async function findUserByEmail(email: string): Promise<UserRecord | undefined> {
  if (!isDatabaseConfigured()) {
    const ff = await getFlatFile();
    return ff.findUserByEmail(email);
  }
  const db = getDb();
  const rows = await db.select().from(users)
    .where(drizzleSql`LOWER(${users.email}) = LOWER(${email})`)
    .limit(1);
  return rows[0] ? toRecord(rows[0]) : undefined;
}

export async function findUserById(id: string): Promise<UserRecord | undefined> {
  if (!isDatabaseConfigured()) {
    const ff = await getFlatFile();
    return ff.findUserById(id);
  }
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ? toRecord(rows[0]) : undefined;
}

export async function findUserByVerifyToken(token: string): Promise<UserRecord | undefined> {
  if (!isDatabaseConfigured()) {
    const ff = await getFlatFile();
    return ff.findUserByVerifyToken(token);
  }
  const db = getDb();
  const rows = await db.select().from(users)
    .where(eq(users.emailVerifyToken, token))
    .limit(1);
  return rows[0] ? toRecord(rows[0]) : undefined;
}

export async function createUser(
  data: CreateUserInput
): Promise<UserRecord> {
  if (!isDatabaseConfigured()) {
    const ff = await getFlatFile();
    return ff.createUser(data);
  }
  const db = getDb();
  const id = 'usr_' + crypto.randomBytes(8).toString('hex');
  const now = new Date();

  const insert: NewUser = {
    id,
    email:              data.email.toLowerCase(),
    name:               data.name,
    phone:              data.phone ?? null,
    country:            data.country ?? null,
    status:             (data.status ?? 'pending_verification') as User['status'],
    kycStatus:          (data.kycStatus ?? 'not_submitted') as User['kycStatus'],
    amlStatus:          data.amlStatus ?? 'not_screened',
    amlRiskLevel:       data.amlRiskLevel ?? 'unrated',
    emailVerified:      data.emailVerified ?? false,
    emailVerifyToken:   data.emailVerifyToken ?? null,
    emailVerifyExpiry:  data.emailVerifyExpiry ? new Date(data.emailVerifyExpiry) : null,
    passwordHash:       data.passwordHash,
    loginAttempts:      0,
    ip:                 data.ip ?? null,
    balance:            data.balance ?? 0,
    primaryCurrency:    data.primaryCurrency ?? 'USD',
    accountTier:        (data.accountTier ?? 'personal') as User['accountTier'],
    requestedProduct:   data.requestedProduct ?? null,
    address:            data.address ?? null,
    city:               data.city ?? null,
    postalCode:         data.postalCode ?? null,
    createdAt:          now,
    updatedAt:          now,
  };

  const rows = await db.insert(users).values(insert).returning();
  return toRecord(rows[0]);
}

/**
 * Create the customer and the first registration-workflow case atomically.
 *
 * The public registration endpoint uses this path so a successful response can
 * never leave a customer profile outside the administration intake queue. The
 * opaque case reference is safe to display to the customer; credentials,
 * identity documents and session tokens are deliberately excluded.
 */
export async function createUserWithRegistrationCase(
  data: CreateUserInput,
  caseType: 'individual' | 'business',
): Promise<{ user: UserRecord; applicationReference: string | null }> {
  if (!isDatabaseConfigured()) {
    const user = await createUser(data);
    return { user, applicationReference: null };
  }

  const db = getDb();
  const userId = 'usr_' + crypto.randomBytes(8).toString('hex');
  const caseId = 'oc_' + crypto.randomBytes(10).toString('hex');
  const eventId = 'oe_' + crypto.randomBytes(10).toString('hex');
  const now = new Date();
  const insert: NewUser = {
    id: userId,
    email: data.email.toLowerCase(),
    name: data.name,
    phone: data.phone ?? null,
    country: data.country ?? null,
    status: (data.status ?? 'pending_verification') as User['status'],
    kycStatus: (data.kycStatus ?? 'not_submitted') as User['kycStatus'],
    amlStatus: data.amlStatus ?? 'not_screened',
    amlRiskLevel: data.amlRiskLevel ?? 'unrated',
    emailVerified: data.emailVerified ?? false,
    emailVerifyToken: data.emailVerifyToken ?? null,
    emailVerifyExpiry: data.emailVerifyExpiry ? new Date(data.emailVerifyExpiry) : null,
    passwordHash: data.passwordHash,
    loginAttempts: 0,
    ip: data.ip ?? null,
    balance: data.balance ?? 0,
    primaryCurrency: data.primaryCurrency ?? 'USD',
    accountTier: (data.accountTier ?? 'personal') as User['accountTier'],
    requestedProduct: data.requestedProduct ?? null,
    address: data.address ?? null,
    city: data.city ?? null,
    postalCode: data.postalCode ?? null,
    createdAt: now,
    updatedAt: now,
  };

  return db.transaction(async (tx) => {
    const rows = await tx.insert(users).values(insert).returning();
    await tx.insert(onboardingCases).values({
      id: caseId,
      userId,
      caseType,
      status: 'draft',
      version: 1,
      lastEditedBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(onboardingEvents).values({
      id: eventId,
      caseId,
      userId,
      action: 'registration_received',
      actorId: userId,
      actorType: 'customer',
      toStatus: 'draft',
      details: {
        requestedProduct: data.requestedProduct ?? null,
        accountTier: data.accountTier ?? 'personal',
        workflowVersion: 1,
      },
      createdAt: now,
    });
    return { user: toRecord(rows[0]), applicationReference: caseId };
  });
}

export async function updateUser(id: string, patch: UserUpdatePatch): Promise<UserRecord | null> {
  if (!isDatabaseConfigured()) {
    const ff = await getFlatFile();
    return ff.updateUser(id, patch);
  }
  const db = getDb();
  const safe = stripDangerousKeys(patch as Record<string, unknown>) as UserUpdatePatch;

  // Map camelCase patch → snake_case DB columns
  const dbPatch: Partial<NewUser> = {};
  if (safe.email !== undefined)              dbPatch.email              = safe.email.toLowerCase();
  if (safe.name !== undefined)               dbPatch.name               = safe.name;
  if (safe.phone !== undefined)              dbPatch.phone              = safe.phone ?? null;
  if (safe.country !== undefined)            dbPatch.country            = safe.country ?? null;
  if (safe.status !== undefined)             dbPatch.status             = safe.status as User['status'];
  if (safe.kycStatus !== undefined)          dbPatch.kycStatus          = safe.kycStatus as User['kycStatus'];
  if (safe.amlStatus !== undefined)          dbPatch.amlStatus          = safe.amlStatus;
  if (safe.amlRiskLevel !== undefined)       dbPatch.amlRiskLevel       = safe.amlRiskLevel;
  if (safe.amlReviewedAt !== undefined)      dbPatch.amlReviewedAt      = safe.amlReviewedAt ? new Date(safe.amlReviewedAt) : null;
  if (safe.amlReviewedBy !== undefined)      dbPatch.amlReviewedBy      = safe.amlReviewedBy ?? null;
  if (safe.amlReviewReason !== undefined)    dbPatch.amlReviewReason    = safe.amlReviewReason ?? null;
  if (safe.amlNextReviewAt !== undefined)    dbPatch.amlNextReviewAt    = safe.amlNextReviewAt ? new Date(safe.amlNextReviewAt) : null;
  if (safe.emailVerified !== undefined)      dbPatch.emailVerified      = safe.emailVerified;
  if (safe.emailVerifyToken !== undefined)   dbPatch.emailVerifyToken   = safe.emailVerifyToken ?? null;
  if (safe.emailVerifyExpiry !== undefined)  dbPatch.emailVerifyExpiry  = safe.emailVerifyExpiry ? new Date(safe.emailVerifyExpiry) : null;
  if (safe.passwordHash !== undefined)       dbPatch.passwordHash       = safe.passwordHash;
  if (safe.credentialVersion !== undefined)  dbPatch.credentialVersion  = safe.credentialVersion;
  if (safe.loginAttempts !== undefined)      dbPatch.loginAttempts      = safe.loginAttempts;
  if (safe.lastLoginAt !== undefined)        dbPatch.lastLoginAt        = safe.lastLoginAt ? new Date(safe.lastLoginAt) : null;
  if (safe.lastLoginIp !== undefined)        dbPatch.lastLoginIp        = safe.lastLoginIp ?? null;
  if (safe.ip !== undefined)                 dbPatch.ip                 = safe.ip ?? null;
  if (safe.balance !== undefined)            dbPatch.balance            = safe.balance ?? 0;
  if (safe.bankName !== undefined)           dbPatch.bankName           = safe.bankName ?? null;
  if (safe.bankAccountNumber !== undefined)  dbPatch.bankAccountNumber  = safe.bankAccountNumber ?? null;
  if (safe.bankRoutingNumber !== undefined)  dbPatch.bankRoutingNumber  = safe.bankRoutingNumber ?? null;
  if (safe.bankSwift !== undefined)          dbPatch.bankSwift          = safe.bankSwift ?? null;
  if (safe.bankIban !== undefined)           dbPatch.bankIban           = safe.bankIban ?? null;
  if (safe.walletBtc !== undefined)          dbPatch.walletBtc          = safe.walletBtc ?? null;
  if (safe.walletEth !== undefined)          dbPatch.walletEth          = safe.walletEth ?? null;
  if (safe.walletUsdt !== undefined)         dbPatch.walletUsdt         = safe.walletUsdt ?? null;
  if (safe.walletSol !== undefined)          dbPatch.walletSol          = safe.walletSol ?? null;
  if (safe.avatarUrl !== undefined)          dbPatch.avatarUrl          = safe.avatarUrl ?? null;
  if (safe.dateOfBirth !== undefined)        dbPatch.dateOfBirth        = safe.dateOfBirth ?? null;
  if (safe.address !== undefined)            dbPatch.address            = safe.address ?? null;
  if (safe.city !== undefined)               dbPatch.city               = safe.city ?? null;
  if (safe.postalCode !== undefined)         dbPatch.postalCode         = safe.postalCode ?? null;
  if (safe.idType !== undefined)             dbPatch.idType             = safe.idType ?? null;
  if (safe.idNumber !== undefined)           dbPatch.idNumber           = safe.idNumber ?? null;
  if (safe.idDocumentUrl !== undefined)      dbPatch.idDocumentUrl      = safe.idDocumentUrl ?? null;
  if (safe.kycSubmittedAt !== undefined)     dbPatch.kycSubmittedAt     = safe.kycSubmittedAt ? new Date(safe.kycSubmittedAt) : null;
  if (safe.kycApprovedAt !== undefined)      dbPatch.kycApprovedAt      = safe.kycApprovedAt ? new Date(safe.kycApprovedAt) : null;
  if (safe.kycExpiresAt !== undefined)       dbPatch.kycExpiresAt       = safe.kycExpiresAt ? new Date(safe.kycExpiresAt) : null;
  if (safe.kycReviewedBy !== undefined)      dbPatch.kycReviewedBy      = safe.kycReviewedBy ?? null;
  if (safe.kycReviewReason !== undefined)    dbPatch.kycReviewReason    = safe.kycReviewReason ?? null;
  if (safe.kycRejectedAt !== undefined)      dbPatch.kycRejectedAt      = safe.kycRejectedAt ? new Date(safe.kycRejectedAt) : null;
  if (safe.kycRejectionReason !== undefined) dbPatch.kycRejectionReason = safe.kycRejectionReason ?? null;
  if (safe.selfieUrl !== undefined)          dbPatch.selfieUrl          = safe.selfieUrl ?? null;
  if (safe.approvedAt !== undefined)         dbPatch.approvedAt         = safe.approvedAt ? new Date(safe.approvedAt) : null;
  if (safe.approvedBy !== undefined)         dbPatch.approvedBy         = safe.approvedBy ?? null;
  if (safe.rejectedAt !== undefined)         dbPatch.rejectedAt         = safe.rejectedAt ? new Date(safe.rejectedAt) : null;
  if (safe.rejectedBy !== undefined)         dbPatch.rejectedBy         = safe.rejectedBy ?? null;
  if (safe.rejectionReason !== undefined)    dbPatch.rejectionReason    = safe.rejectionReason ?? null;
  if (safe.primaryCurrency !== undefined)    dbPatch.primaryCurrency    = safe.primaryCurrency ?? 'USD';
  if (safe.accountTier !== undefined)        dbPatch.accountTier        = safe.accountTier as User['accountTier'];
  if (safe.totpSecret !== undefined)         dbPatch.totpSecret         = safe.totpSecret ?? null;
  if (safe.totpEnabled !== undefined)        dbPatch.totpEnabled        = safe.totpEnabled;
  if (safe.totpRecoveryHashes !== undefined) dbPatch.totpRecoveryHashes = safe.totpRecoveryHashes ?? null;
  if (safe.locale !== undefined)             dbPatch.locale             = safe.locale ?? null;
  if (safe.timezone !== undefined)           dbPatch.timezone           = safe.timezone ?? null;
  if (safe.notificationPrefs !== undefined)  dbPatch.notificationPrefs  = safe.notificationPrefs ?? null;
  if (safe.beneficiaries !== undefined)      dbPatch.beneficiaries      = safe.beneficiaries ?? null;
  if (safe.trustedDevices !== undefined)     dbPatch.trustedDevices     = safe.trustedDevices ?? null;

  // Let PostgreSQL assign the timestamp. With postgres.js running in
  // prepare:false mode, passing a JavaScript Date through this update path can
  // reach the raw serializer and fail before the statement is executed.
  const rows = await db.update(users)
    .set({ ...dbPatch, updatedAt: drizzleSql`now()` })
    .where(eq(users.id, id))
    .returning();
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function deleteUser(id: string): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    const ff = await getFlatFile();
    return ff.deleteUser(id);
  }
  const db = getDb();
  const rows = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
  return rows.length > 0;
}

/**
 * Persist a canonical rehash only when the credential is still the one that
 * was verified. This prevents a slow legacy-login request from overwriting a
 * concurrent password reset with an equivalent hash of the old password.
 */
export async function upgradeCustomerPasswordHash(
  userId: string,
  expectedOldHash: string,
  upgradedHash: string,
): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    const ff = await getFlatFile();
    const current = ff.findUserById(userId);
    if (!current || current.passwordHash !== expectedOldHash) return false;
    return Boolean(ff.updateUser(userId, { passwordHash: upgradedHash }));
  }
  const updated = await getDb().update(users)
    .set({ passwordHash: upgradedHash, updatedAt: drizzleSql`now()` })
    .where(and(eq(users.id, userId), eq(users.passwordHash, expectedOldHash)))
    .returning({ id: users.id });
  return updated.length === 1;
}

export function generateVerifyToken(): { token: string; expiry: string } {
  return {
    token:  crypto.randomBytes(32).toString('hex'),
    expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function detectDuplicate(
  email: string,
  ip?: string
): Promise<{ isDuplicate: boolean; reason?: string }> {
  if (!isDatabaseConfigured()) {
    const ff = await getFlatFile();
    return ff.detectDuplicate(email, ip);
  }
  const db = getDb();

  const existing = await db.select({ id: users.id })
    .from(users)
    .where(drizzleSql`LOWER(${users.email}) = LOWER(${email})`)
    .limit(1);

  if (existing.length > 0) return { isDuplicate: true, reason: 'email_exists' };

  if (ip) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentFromIp = await db.select({ id: users.id })
      .from(users)
      .where(drizzleSql`${users.ip} = ${ip} AND ${users.createdAt} > ${oneHourAgo.toISOString()}`)
      .limit(3);
    if (recentFromIp.length >= 3) return { isDuplicate: true, reason: 'too_many_from_ip' };
  }

  return { isDuplicate: false };
}

/**
 * findUserBySessionToken — looks up the customer_sessions table.
 * Session management is now in customerSessionStore.ts.
 * This shim is kept for backward compatibility with existing call sites.
 */
export async function findUserBySessionToken(token: string): Promise<UserRecord | undefined> {
  if (!token) return undefined;
  if (!isDatabaseConfigured()) {
    const ff = await getFlatFile();
    return ff.findUserBySessionToken(token);
  }
  // Delegate to the session store
  const { findUserByCustomerToken } = await import('./customerSessionStore.js');
  return findUserByCustomerToken(token);
}
