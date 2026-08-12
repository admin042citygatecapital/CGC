import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  appendAuditEntry: vi.fn(),
  appendCriticalAudit: vi.fn(),
  outerInsert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../server/lib/auditLog.js', () => ({
  appendAuditEntry: dependencies.appendAuditEntry,
  appendCriticalAudit: dependencies.appendCriticalAudit,
}));

vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => true,
  getDb: () => ({
    insert: dependencies.outerInsert,
    transaction: dependencies.transaction,
  }),
}));

import { saveSponsorEvidence } from '../../server/lib/sponsorReadinessStore.js';

const actor = { id: 'compliance-maker', email: 'compliance@example.test', role: 'COMPLIANCE_ADMIN' as const };
const input = {
  controlKey: 'legal_entity_verified',
  title: 'Controlled legal entity reference',
  referenceType: 'internal' as const,
  reference: 'CGC-LEGAL-ENTITY-001',
  sha256: 'a'.repeat(64),
  owner: 'Compliance owner',
};

describe('sponsor readiness audit durability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.appendCriticalAudit.mockResolvedValue(undefined);
    dependencies.appendAuditEntry.mockResolvedValue(undefined);
    dependencies.outerInsert.mockReturnValue({
      values: vi.fn(() => ({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) })),
    });
    dependencies.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      let insertCount = 0;
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => {
            insertCount += 1;
            if (insertCount === 1) {
              return {
                returning: vi.fn().mockResolvedValue([{
                  id: 'sev-created', packageId: 'uk-multicurrency-v1', ...input,
                  status: 'draft', issuedAt: null, expiresAt: null, notes: null,
                  createdBy: actor.id, lastEditedBy: actor.id, submittedBy: null,
                  submittedAt: null, reviewedBy: null, reviewedAt: null, reviewNote: null,
                  createdAt: new Date(), updatedAt: new Date(),
                }]),
              };
            }
            return Promise.resolve(undefined);
          }),
        })),
      };
      return callback(tx);
    });
  });

  it('fails closed before opening a mutation transaction when the audit intent cannot persist', async () => {
    dependencies.appendCriticalAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(saveSponsorEvidence(input, actor)).rejects.toThrow('audit unavailable');

    expect(dependencies.transaction).not.toHaveBeenCalled();
    expect(dependencies.appendAuditEntry).not.toHaveBeenCalled();
  });

  it('persists the audit intent before atomically recording evidence and its lifecycle event', async () => {
    await expect(saveSponsorEvidence(input, actor)).resolves.toMatchObject({ id: 'sev-created', status: 'draft' });

    expect(dependencies.appendCriticalAudit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'sponsor_evidence_create_intent',
      adminId: actor.id,
    }));
    expect(dependencies.transaction).toHaveBeenCalledTimes(1);
    expect(dependencies.appendCriticalAudit.mock.invocationCallOrder[0]).toBeLessThan(dependencies.transaction.mock.invocationCallOrder[0]);
    expect(dependencies.appendAuditEntry).toHaveBeenCalledWith(expect.objectContaining({ action: 'sponsor_evidence_created' }));
  });
});
