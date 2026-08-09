import { describe, expect, it } from 'vitest';
import { evaluateFinancialAccess } from '../../server/lib/complianceGate.js';
import type { UserRecord } from '../../server/lib/userStore.js';

function customer(overrides: Partial<UserRecord> = {}): UserRecord {
  const now = new Date().toISOString();
  return {
    id: 'usr_compliance_test',
    email: 'customer@example.test',
    name: 'Compliance Test',
    status: 'active',
    kycStatus: 'approved',
    kycApprovedAt: now,
    amlStatus: 'cleared',
    amlRiskLevel: 'low',
    amlReviewedAt: now,
    amlReviewedBy: 'admin_compliance',
    amlReviewReason: 'Documented screening evidence reviewed and cleared.',
    amlNextReviewAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
    emailVerified: true,
    passwordHash: 'test-only',
    loginAttempts: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('financial compliance gate', () => {
  it('permits access only when KYC and AML decisions are current', async () => {
    await expect(evaluateFinancialAccess(customer())).resolves.toMatchObject({ allowed: true });
  });

  it('fails closed when AML has not been cleared', async () => {
    await expect(evaluateFinancialAccess(customer({ amlStatus: 'pending' }))).resolves.toMatchObject({
      allowed: false,
      code: 'AML_NOT_CLEARED',
    });
  });

  it('fails closed when KYC has not been approved', async () => {
    await expect(evaluateFinancialAccess(customer({ kycStatus: 'submitted' }))).resolves.toMatchObject({
      allowed: false,
      code: 'KYC_REQUIRED',
    });
  });

  it('fails closed when KYC approval evidence is incomplete', async () => {
    await expect(evaluateFinancialAccess(customer({ kycApprovedAt: undefined }))).resolves.toMatchObject({
      allowed: false,
      code: 'KYC_REQUIRED',
    });
  });

  it('fails closed when AML clearance evidence is incomplete', async () => {
    await expect(evaluateFinancialAccess(customer({ amlReviewReason: undefined }))).resolves.toMatchObject({
      allowed: false,
      code: 'AML_EVIDENCE_INCOMPLETE',
    });
  });

  it('fails closed when the scheduled AML review is overdue', async () => {
    await expect(evaluateFinancialAccess(customer({ amlNextReviewAt: new Date(Date.now() - 1000).toISOString() }))).resolves.toMatchObject({
      allowed: false,
      code: 'AML_REVIEW_EXPIRED',
    });
  });

  it('fails closed for inactive or unverified accounts', async () => {
    await expect(evaluateFinancialAccess(customer({ status: 'frozen' }))).resolves.toMatchObject({ code: 'ACCOUNT_INACTIVE' });
    await expect(evaluateFinancialAccess(customer({ emailVerified: false }))).resolves.toMatchObject({ code: 'EMAIL_UNVERIFIED' });
  });
});
