import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  appendAuditEntry: vi.fn(),
  appendCriticalAudit: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../server/lib/auditLog.js', () => ({
  appendAuditEntry: dependencies.appendAuditEntry,
  appendCriticalAudit: dependencies.appendCriticalAudit,
}));

vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => true,
  getDb: () => ({
    insert: dependencies.insert,
    select: dependencies.select,
    transaction: dependencies.transaction,
  }),
}));

import { getSponsorReadiness } from '../../server/lib/sponsorReadinessStore.js';

const actor = { id: 'external_checker_1234567890abcdef', email: 'checker@example.test', role: 'COMPLIANCE_ADMIN' as const };
const expiredAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2025-12-01T00:00:00.000Z');

describe('sponsor evidence expiry package invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.appendAuditEntry.mockResolvedValue(undefined);
    dependencies.appendCriticalAudit.mockResolvedValue(undefined);
    dependencies.insert.mockReturnValue({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) })) });

    const expiredEvidence = {
      id: 'sev_expired', packageId: 'uk-multicurrency-v1', controlKey: 'consumer_kyc_policy',
      title: 'Expired KYC control', status: 'submitted', referenceType: 'internal', reference: 'CGC-KYC-EXP',
      sha256: 'a'.repeat(64), owner: 'Compliance owner', issuedAt: new Date('2025-01-01T00:00:00.000Z'),
      expiresAt: expiredAt, notes: null, createdBy: 'maker', lastEditedBy: 'maker', submittedBy: 'maker',
      submittedAt: new Date('2025-12-01T00:00:00.000Z'), reviewedBy: null, reviewedAt: null, reviewNote: null,
      createdAt: new Date('2025-01-01T00:00:00.000Z'), updatedAt,
    };
    const packageRow = {
      id: 'uk-multicurrency-v1', version: '1.0', jurisdiction: 'United Kingdom', legalEntityState: 'unverified',
      status: 'submitted', submittedBy: 'super-admin', submittedAt: updatedAt,
      reviewedBy: null, reviewedAt: null, reviewNote: null, updatedAt,
    };

    let selectCall = 0;
    dependencies.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          selectCall += 1;
          if (selectCall === 1) return Promise.resolve([expiredEvidence]);
          if (selectCall === 2) return { limit: vi.fn().mockResolvedValue([packageRow]) };
          if (selectCall === 3) return { orderBy: vi.fn().mockResolvedValue([{ ...expiredEvidence, status: 'expired' }]) };
          if (selectCall === 4) return { orderBy: vi.fn().mockResolvedValue([]) };
          if (selectCall === 5) return { limit: vi.fn().mockResolvedValue([]) };
          return Promise.resolve([]);
        }),
      })),
    }));
  });

  it('atomically expires stale evidence and resets a submitted package to draft', async () => {
    const packageSet = vi.fn();
    dependencies.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      let updateCall = 0;
      const tx = {
        update: vi.fn(() => {
          updateCall += 1;
          if (updateCall === 1) return { set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'sev_expired' }]) })) })) };
          return { set: packageSet.mockImplementation(() => ({ where: vi.fn().mockResolvedValue(undefined) })) };
        }),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
      };
      return callback(tx);
    });

    const snapshot = await getSponsorReadiness(actor);

    expect(snapshot.evidence[0]).toMatchObject({ id: 'sev_expired', effectiveStatus: 'expired' });
    expect(packageSet).toHaveBeenCalledWith(expect.objectContaining({
      status: 'draft', submittedBy: null, submittedAt: null, reviewedBy: null, reviewedAt: null,
    }));
    expect(dependencies.appendCriticalAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'sponsor_evidence_expire_intent' }));
    expect(dependencies.appendAuditEntry).toHaveBeenCalledWith(expect.objectContaining({ action: 'sponsor_evidence_expired' }));
  });
});
