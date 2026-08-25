import { describe, expect, it } from 'vitest';
import {
  addUtcMonths,
  buildKycQueueEntry,
  calculateKycStats,
  getEffectiveKycStatus,
  getKycExpiryAt,
  isOperationalKycUser,
  type KycSettings,
} from '../../server/lib/kycStore.js';
import type { UserRecord } from '../../server/lib/userStore.js';

const settings: KycSettings = {
  expiryMonths: 12,
  renewalReminderDays: 30,
  autoRestrictExpired: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function user(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'usr_test',
    email: 'customer@example.test',
    name: 'Customer',
    status: 'pending_approval',
    kycStatus: 'submitted',
    amlStatus: 'not_screened',
    amlRiskLevel: 'unrated',
    emailVerified: true,
    passwordHash: 'not-used',
    credentialVersion: 1,
    loginAttempts: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    dataClassification: 'customer',
    ...overrides,
  };
}

describe('KYC lifecycle reporting', () => {
  it('uses calendar months without overflowing short months', () => {
    expect(addUtcMonths(new Date('2024-01-31T12:00:00.000Z'), 1).toISOString())
      .toBe('2024-02-29T12:00:00.000Z');
  });

  it('prefers explicit expiry and separates approved from expired', () => {
    const approved = user({
      kycStatus: 'approved',
      kycApprovedAt: '2025-01-01T00:00:00.000Z',
      kycExpiresAt: '2027-01-01T00:00:00.000Z',
    });
    expect(getKycExpiryAt(approved, settings)?.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(getEffectiveKycStatus(approved, settings, Date.parse('2026-06-01T00:00:00.000Z'))).toBe('approved');
    expect(getEffectiveKycStatus(approved, settings, Date.parse('2027-01-01T00:00:00.000Z'))).toBe('expired');
    expect(buildKycQueueEntry(approved, settings)).toMatchObject({ kycStatus: 'approved', storedKycStatus: 'approved' });
  });

  it('excludes quarantined identities and avoids stale decision double-counting', () => {
    const now = Date.parse('2026-08-12T12:00:00.000Z');
    const records = [
      user({ id: 'pending', kycStatus: 'submitted', kycSubmittedAt: '2026-08-10T10:00:00.000Z' }),
      user({ id: 'approved', kycStatus: 'approved', kycSubmittedAt: '2026-08-10T10:00:00.000Z', kycApprovedAt: '2026-08-11T10:00:00.000Z', kycExpiresAt: '2027-08-11T10:00:00.000Z', kycRejectedAt: '2026-08-11T11:00:00.000Z' }),
      user({ id: 'expired', kycStatus: 'approved', kycApprovedAt: '2025-01-01T00:00:00.000Z', kycExpiresAt: '2026-01-01T00:00:00.000Z' }),
      user({ id: 'rejected', kycStatus: 'rejected', kycSubmittedAt: '2026-08-10T00:00:00.000Z', kycRejectedAt: '2026-08-11T00:00:00.000Z', kycApprovedAt: '2026-08-09T00:00:00.000Z' }),
      user({ id: 'quarantined', kycStatus: 'submitted', dataClassification: 'quarantined_test', quarantineBatchId: 'batch-1' }),
    ];

    const stats = calculateKycStats(records, settings, now);
    expect(stats).toMatchObject({
      pending: 1,
      approvedThisWeek: 1,
      rejectedThisWeek: 1,
      expired: 1,
      totalApproved: 1,
      totalRejected: 1,
    });
    expect(isOperationalKycUser(records[4])).toBe(false);
  });
});
