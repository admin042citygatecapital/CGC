import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  findUserById: vi.fn(), updateUser: vi.fn(), appendAudit: vi.fn(), appendCriticalAudit: vi.fn(),
  sendApprovalEmail: vi.fn(), evaluateFinancialAccess: vi.fn(), getLatestOnboardingCaseForUser: vi.fn(),
  assertProviderVerificationComplete: vi.fn(),
}));

vi.mock('../../server/lib/userStore.js', () => ({ findUserById: dependencies.findUserById, updateUser: dependencies.updateUser }));
vi.mock('../../server/lib/auditLog.js', () => ({ appendAudit: dependencies.appendAudit, appendCriticalAudit: dependencies.appendCriticalAudit }));
vi.mock('../../server/lib/emailService.js', () => ({ sendApprovalEmail: dependencies.sendApprovalEmail }));
vi.mock('../../server/lib/complianceGate.js', () => ({ evaluateFinancialAccess: dependencies.evaluateFinancialAccess }));
vi.mock('../../server/lib/onboardingStore.js', () => ({ getLatestOnboardingCaseForUser: dependencies.getLatestOnboardingCaseForUser }));
vi.mock('../../server/lib/onboardingProviderStore.js', () => ({ assertProviderVerificationComplete: dependencies.assertProviderVerificationComplete }));

import handler from '../../server/api/admin/users/approve/POST.js';

const admin = { adminId: 'only-super-admin', email: 'admin@example.test', role: 'SUPER_ADMIN' };
const user = {
  id: 'usr-test', name: 'Test Customer', email: 'customer@example.test', status: 'pending_approval',
  kycStatus: 'approved', amlStatus: 'cleared', emailVerified: true,
  kycReviewedBy: admin.adminId, amlReviewedBy: admin.adminId,
};
const onboardingCase = { id: 'oc-test', caseType: 'individual' as const };

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res); res.json.mockReturnValue(res);
  return res;
}
function request() {
  return { body: { userId: user.id, reason: 'All provider-backed controls reviewed.' }, ip: '127.0.0.1', adminSession: admin };
}

describe('single-super-admin final registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.findUserById.mockResolvedValue(user);
    dependencies.updateUser.mockResolvedValue({ ...user, status: 'active' });
    dependencies.evaluateFinancialAccess.mockResolvedValue({ allowed: true, code: 'ALLOWED', message: 'Allowed' });
    dependencies.getLatestOnboardingCaseForUser.mockResolvedValue(onboardingCase);
    dependencies.assertProviderVerificationComplete.mockResolvedValue(undefined);
    dependencies.appendCriticalAudit.mockResolvedValue(undefined);
    dependencies.sendApprovalEmail.mockResolvedValue(undefined);
  });

  it('uses signed provider evidence as the independent maker instead of inventing a second admin account', async () => {
    const res = response();
    await handler(request() as never, res as never);

    expect(dependencies.assertProviderVerificationComplete).toHaveBeenCalledWith(onboardingCase.id, 'individual');
    expect(dependencies.appendCriticalAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin_user_approve_intent' }));
    expect(dependencies.updateUser).toHaveBeenCalledWith(user.id, expect.objectContaining({ status: 'active', approvedBy: admin.adminId }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('does not activate a profile without current independent provider evidence', async () => {
    dependencies.assertProviderVerificationComplete.mockRejectedValueOnce(Object.assign(new Error('Provider screening required'), { code: 'PROVIDER_SCREENING_REQUIRED' }));
    const res = response();

    await handler(request() as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(dependencies.appendCriticalAudit).not.toHaveBeenCalled();
    expect(dependencies.updateUser).not.toHaveBeenCalled();
  });

  it('fails closed before activation when the critical audit intent cannot persist', async () => {
    dependencies.appendCriticalAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(handler(request() as never, response() as never)).rejects.toThrow('audit unavailable');
    expect(dependencies.updateUser).not.toHaveBeenCalled();
  });

  it('migrates a distinct KYC reviewer identity instead of overloading final approval ownership', () => {
    const migration = readFileSync('src/server/db/migrations/0018_kyc_reviewer_identity.sql', 'utf8');
    expect(migration).toContain('kyc_reviewed_by');
    expect(migration).toContain('kyc_review_reason');
  });
});
