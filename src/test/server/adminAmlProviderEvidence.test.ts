import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  findUserById: vi.fn(), updateUser: vi.fn(), appendAudit: vi.fn(), appendCriticalAudit: vi.fn(),
  createNotification: vi.fn(), getLatestOnboardingCaseForUser: vi.fn(), assertProviderVerificationComplete: vi.fn(),
}));
vi.mock('../../server/lib/userStore.js', () => ({ findUserById: dependencies.findUserById, updateUser: dependencies.updateUser }));
vi.mock('../../server/lib/auditLog.js', () => ({ appendAudit: dependencies.appendAudit, appendCriticalAudit: dependencies.appendCriticalAudit }));
vi.mock('../../server/lib/notificationStore.js', () => ({ createNotification: dependencies.createNotification }));
vi.mock('../../server/lib/onboardingStore.js', () => ({ getLatestOnboardingCaseForUser: dependencies.getLatestOnboardingCaseForUser }));
vi.mock('../../server/lib/onboardingProviderStore.js', () => ({ assertProviderVerificationComplete: dependencies.assertProviderVerificationComplete }));

import handler from '../../server/api/admin/kyc/aml/POST.js';

const admin = { adminId: 'only-super-admin', email: 'admin@example.test', role: 'SUPER_ADMIN' };
const user = { id: 'usr-test', name: 'Test Customer', email: 'customer@example.test', status: 'pending_approval', kycStatus: 'approved', kycReviewedBy: admin.adminId, amlStatus: 'pending' };
const onboardingCase = { id: 'oc-test', caseType: 'individual' as const };

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res); res.json.mockReturnValue(res);
  return res;
}
function request() {
  return {
    body: { userId: user.id, amlStatus: 'cleared', amlRiskLevel: 'low', reason: 'Provider screening reviewed and clear.', nextReviewAt: '2030-01-01T00:00:00.000Z' },
    ip: '127.0.0.1', adminSession: admin,
  };
}

describe('provider-backed AML review with one super administrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.findUserById.mockResolvedValue(user);
    dependencies.getLatestOnboardingCaseForUser.mockResolvedValue(onboardingCase);
    dependencies.assertProviderVerificationComplete.mockResolvedValue(undefined);
    dependencies.appendCriticalAudit.mockResolvedValue(undefined);
    dependencies.updateUser.mockResolvedValue({ ...user, amlStatus: 'cleared' });
    dependencies.createNotification.mockResolvedValue(undefined);
  });

  it('allows the sole super-admin to check independent signed provider results', async () => {
    const res = response();
    await handler(request() as never, res as never);

    expect(dependencies.assertProviderVerificationComplete).toHaveBeenCalledWith(onboardingCase.id, 'individual');
    expect(dependencies.appendCriticalAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin_aml_decision_intent' }));
    expect(dependencies.appendCriticalAudit.mock.invocationCallOrder[0]).toBeLessThan(dependencies.updateUser.mock.invocationCallOrder[0]);
    expect(dependencies.updateUser).toHaveBeenCalledWith(user.id, expect.objectContaining({ amlStatus: 'cleared', amlReviewedBy: admin.adminId }));
  });

  it('cannot clear AML when independent provider verification is absent', async () => {
    dependencies.assertProviderVerificationComplete.mockRejectedValueOnce(Object.assign(new Error('Provider screening required'), { code: 'PROVIDER_SCREENING_REQUIRED' }));
    const res = response();

    await handler(request() as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(dependencies.appendCriticalAudit).not.toHaveBeenCalled();
    expect(dependencies.updateUser).not.toHaveBeenCalled();
  });
});
