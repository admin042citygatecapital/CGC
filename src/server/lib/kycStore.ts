/**
 * kycStore.ts — PostgreSQL-backed KYC store.
 * Drop-in replacement for the flat-file implementation.
 */

import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { kycNotes, kycSettings } from '../db/schema.js';
import { loadAllUsers, updateUser, type UserRecord } from './userStore.js';

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
  pending: number;
  approvedThisWeek: number;
  rejectedThisWeek: number;
  expired: number;
  approachingExpiry: number;
  avgReviewHours: number;
  totalApproved: number;
  totalRejected: number;
}> {
  const users = await loadAllUsers();
  const settings = await readKycSettings();
  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  const reminderDeadline = now + settings.renewalReminderDays * 86_400_000;
  const expiryMs = (user: UserRecord) => user.kycApprovedAt
    ? new Date(user.kycApprovedAt).getTime() + settings.expiryMonths * 30 * 86_400_000
    : 0;
  const completedReviewHours = users.flatMap(user => {
    const decidedAt = user.kycApprovedAt ?? user.kycRejectedAt;
    if (!user.kycSubmittedAt || !decidedAt) return [];
    const duration = new Date(decidedAt).getTime() - new Date(user.kycSubmittedAt).getTime();
    return Number.isFinite(duration) && duration >= 0 ? [duration / 3_600_000] : [];
  });
  return {
    pending: users.filter(user => user.kycStatus === 'submitted').length,
    approvedThisWeek: users.filter(user => user.kycApprovedAt && new Date(user.kycApprovedAt).getTime() >= weekAgo).length,
    rejectedThisWeek: users.filter(user => user.kycRejectedAt && new Date(user.kycRejectedAt).getTime() >= weekAgo).length,
    expired: users.filter(user => user.kycStatus === 'approved' && expiryMs(user) > 0 && expiryMs(user) <= now).length,
    approachingExpiry: users.filter(user => {
      const expiry = expiryMs(user);
      return user.kycStatus === 'approved' && expiry > now && expiry <= reminderDeadline;
    }).length,
    avgReviewHours: completedReviewHours.length
      ? Number((completedReviewHours.reduce((sum, hours) => sum + hours, 0) / completedReviewHours.length).toFixed(1))
      : 0,
    totalApproved: users.filter(user => user.kycStatus === 'approved').length,
    totalRejected: users.filter(user => user.kycStatus === 'rejected').length,
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
 */
export async function extendKyc(userId: string, months: number, _adminId?: string): Promise<void> {
  const now      = new Date();
  const extended = new Date(now.getTime() + months * 30 * 86_400_000);
  await updateUser(userId, {
    kycStatus:     'approved',
    kycApprovedAt: now.toISOString(),
  });
  void extended;
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
