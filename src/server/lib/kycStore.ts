/**
 * kycStore.ts — PostgreSQL-backed KYC store.
 * Drop-in replacement for the flat-file implementation.
 */

import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { kycNotes, kycSettings } from '../db/schema.js';
import { loadAllUsers, updateUser, type UserRecord } from './userStore.js';
import { upsertKYCExpiry, getExpiryByUserId } from './kycExpiryStore.js';
import { queryFlags } from './securityStore.js';
import { getKYCAuditLog } from './kycAuditStore.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KycSettings {
  expiryMonths:          number;
  renewalReminderDays:   number;
  autoRestrictExpired:   boolean;
  updatedAt:             string;
  updatedBy?:            string;
}

export interface KycNote {
  id?:       string;
  userId:    string;
  adminId:   string;
  adminName?: string;
  note:      string;
  createdAt: string;
}

const DEFAULT_SETTINGS: KycSettings = {
  expiryMonths:        12,
  renewalReminderDays: 30,
  autoRestrictExpired: true,
  updatedAt:           new Date().toISOString(),
};

// ── Flat-file fallback ────────────────────────────────────────────────────────

let _ff: typeof import('./kycStore.flatfile.js') | null = null;
async function ff() {
  if (!_ff) _ff = await import('./kycStore.flatfile.js');
  return _ff;
}

// ── KYC Settings ──────────────────────────────────────────────────────────────

export async function readKycSettings(): Promise<KycSettings> {
  if (!isDatabaseConfigured()) return (await ff()).readKycSettings();
  const db   = getDb();
  const rows = await db.select().from(kycSettings).where(eq(kycSettings.id, 1)).limit(1);
  if (rows.length === 0) return DEFAULT_SETTINGS;
  const r = rows[0];
  return {
    expiryMonths:        r.expiryMonths,
    renewalReminderDays: r.renewalReminderDays,
    autoRestrictExpired: r.autoRestrictExpired,
    updatedAt:           r.updatedAt.toISOString(),
    updatedBy:           r.updatedBy ?? undefined,
  };
}

export async function writeKycSettings(s: KycSettings): Promise<void> {
  if (!isDatabaseConfigured()) return (await ff()).writeKycSettings(s);
  const db = getDb();
  await db.insert(kycSettings).values({
    id:                   1,
    expiryMonths:         s.expiryMonths,
    renewalReminderDays:  s.renewalReminderDays,
    autoRestrictExpired:  s.autoRestrictExpired,
    updatedAt:            new Date(),
    updatedBy:            s.updatedBy ?? null,
  }).onConflictDoUpdate({
    target: kycSettings.id,
    set: {
      expiryMonths:        s.expiryMonths,
      renewalReminderDays: s.renewalReminderDays,
      autoRestrictExpired: s.autoRestrictExpired,
      updatedAt:           new Date(),
      updatedBy:           s.updatedBy ?? null,
    },
  });
}

// ── KYC Notes ─────────────────────────────────────────────────────────────────

export async function appendKycNote(n: KycNote): Promise<void> {
  if (!isDatabaseConfigured()) return (await ff()).appendKycNote(n);
  const db = getDb();
  await db.insert(kycNotes).values({
    id:        n.id ?? ('kn_' + crypto.randomBytes(8).toString('hex')),
    userId:    n.userId,
    adminId:   n.adminId,
    adminName: n.adminName ?? null,
    note:      n.note,
    createdAt: new Date(n.createdAt),
  });
}

export async function getKycNotesForUser(userId: string): Promise<KycNote[]> {
  if (!isDatabaseConfigured()) return (await ff()).getKycNotesForUser(userId);
  const db   = getDb();
  const rows = await db.select().from(kycNotes)
    .where(eq(kycNotes.userId, userId))
    .orderBy(kycNotes.createdAt);
  return rows.map(r => ({
    id:        r.id,
    userId:    r.userId,
    adminId:   r.adminId,
    adminName: r.adminName ?? undefined,
    note:      r.note,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ── KYC Queue (reads from users table) ───────────────────────────────────────

export async function getKycQueue(): Promise<UserRecord[]> {
  const users = await loadAllUsers();
  return users.filter(u => u.kycStatus === 'submitted');
}

export async function getKycStats(): Promise<{
  total: number; submitted: number; approved: number; rejected: number; notSubmitted: number;
}> {
  const users = await loadAllUsers();
  return {
    total:        users.length,
    submitted:    users.filter(u => u.kycStatus === 'submitted').length,
    approved:     users.filter(u => u.kycStatus === 'approved').length,
    rejected:     users.filter(u => u.kycStatus === 'rejected').length,
    notSubmitted: users.filter(u => u.kycStatus === 'not_submitted').length,
  };
}

// ── Risk scoring ──────────────────────────────────────────────────────────────

export function computeKycRiskScore(user: UserRecord): number {
  let score = 0;
  if (!user.dateOfBirth)    score += 20;
  if (!user.address)        score += 15;
  if (!user.idDocumentUrl)  score += 25;
  if (!user.selfieUrl)      score += 20;
  if (!user.phone)          score += 10;
  if (user.country === 'NG' || user.country === 'IR' || user.country === 'KP') score += 30;
  return Math.min(score, 100);
}

// ── KYC expiry ────────────────────────────────────────────────────────────────

export async function getExpiringKycUsers(daysAhead: number): Promise<UserRecord[]> {
  const settings = await readKycSettings();
  const users    = await loadAllUsers();
  const now      = Date.now();
  const deadline = now + daysAhead * 86_400_000;

  return users.filter(u => {
    if (u.kycStatus !== 'approved' || !u.kycApprovedAt) return false;
    const approvedMs = new Date(u.kycApprovedAt).getTime();
    const expiryMs   = approvedMs + settings.expiryMonths * 30 * 86_400_000;
    return expiryMs > now && expiryMs <= deadline;
  });
}

// ── KYC lifecycle helpers ─────────────────────────────────────────────────────

/**
 * Extend a user's KYC approval by N months from today.
 *
 * FIX: this previously computed `extended` (the new expiry date) and then
 * discarded it (`void extended`) — kycApprovedAt was reset but the actual
 * expiry tracked in kycExpiryStore.ts (what kycExpiryChecker.ts's reminder
 * job reads) was never touched, so "extend" didn't actually extend
 * anything an expiry check would see. Now upserts the real expiry record
 * too, preserving kycSubmissionId when one already exists.
 */
export async function extendKyc(userId: string, months: number, _adminId?: string): Promise<void> {
  const now      = new Date();
  const expiryDate = new Date(now.getTime() + months * 30 * 86_400_000).toISOString();
  const existing = getExpiryByUserId(userId);
  const renewalDueDate = new Date(new Date(expiryDate).getTime() - 30 * 86_400_000).toISOString();

  await updateUser(userId, {
    kycStatus:     'approved',
    kycApprovedAt: now.toISOString(),
  });

  upsertKYCExpiry({
    userId,
    kycSubmissionId: existing?.kycSubmissionId ?? userId,
    approvedAt: now.toISOString(),
    expiryDate,
    renewalDueDate,
    validityMonths: months,
    status: 'active',
    reminders: { sent30: false, sent14: false, sent7: false, sent1: false },
  });
}

/**
/**
 * Revoke a user's KYC approval.
 */
export async function revokeKyc(userId: string, reason: string, _adminId?: string): Promise<void> {
  await updateUser(userId, {
    kycStatus:          'rejected',
    kycRejectionReason: reason,
  });
}

/** Check if a user's KYC approval has expired based on current settings. */
export function kycIsExpired(user: UserRecord, settings: KycSettings): boolean {
  if (!user.kycApprovedAt) return false;
  const approvedMs = new Date(user.kycApprovedAt).getTime();
  const expiryMs   = approvedMs + settings.expiryMonths * 30 * 86_400_000;
  return Date.now() > expiryMs;
}


// ── Queue rows (real submission-state derivation for the review-queue UI) ────

export type KycQueueStatus = 'pending' | 'approved' | 'rejected' | 'needs_info' | 'flagged';

export interface KycQueueRow {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  submittedAt: string;
  documentType: string;
  countryName: string;
  riskScore: number;
  status: KycQueueStatus;
  assignedReviewer: string | null;
}

/**
 * Real per-submission queue rows for admin/kyc-queue.tsx. There's no
 * "needs_info"/"flagged" field on UserRecord, so those states are derived
 * honestly from actual history: an active kyc_mismatch security flag means
 * "flagged"; the most recent KYC audit entry being "requested_info" (with
 * no later approve/reject) means "needs_info". Excludes users who never
 * submitted KYC at all.
 */
export async function getKycQueueRows(): Promise<KycQueueRow[]> {
  const users = await loadAllUsers();
  const rows: KycQueueRow[] = [];

  for (const user of users) {
    if (user.kycStatus === 'not_submitted') continue;

    let status: KycQueueStatus;
    if (user.kycStatus === 'approved') status = 'approved';
    else if (user.kycStatus === 'rejected') status = 'rejected';
    else {
      const activeFlag = queryFlags({ type: 'kyc_mismatch', status: 'active', userId: user.id }).total > 0;
      if (activeFlag) {
        status = 'flagged';
      } else {
        const latestAudit = getKYCAuditLog({ userId: user.id, limit: 1 })[0];
        status = latestAudit?.action === 'requested_info' ? 'needs_info' : 'pending';
      }
    }

    const assignedEntry = getKYCAuditLog({ userId: user.id }).find(e => e.action === 'assigned');

    rows.push({
      id: user.id,
      userId: user.id,
      fullName: user.name,
      email: user.email,
      submittedAt: user.kycSubmittedAt ?? '',
      documentType: user.idType ?? 'Unknown',
      countryName: user.country ?? 'Unknown',
      riskScore: computeKycRiskScore(user),
      status,
      assignedReviewer: assignedEntry?.reviewerEmail ?? null,
    });
  }

  return rows;
}

/** Build an enriched KYC queue entry for a user. */
export function buildKycQueueEntry(user: UserRecord) {
  return {
    id:              user.id,
    name:            user.name,
    email:           user.email,
    status:          user.status,
    kycStatus:       user.kycStatus,
    kycSubmittedAt:  user.kycSubmittedAt,
    kycApprovedAt:   user.kycApprovedAt,
    kycRejectionReason: user.kycRejectionReason,
    createdAt:       user.createdAt,
    accountTier:     user.accountTier,
    country:         user.country,
    risk:            { score: computeKycRiskScore(user) },
  };
}

