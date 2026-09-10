import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  audit: vi.fn(), stepUp: vi.fn(), database: vi.fn(),
  bundle: vi.fn(), makerChecker: vi.fn(), provider: vi.fn(),
  createAccount: vi.fn(), transfer: vi.fn(), adjust: vi.fn(), mock: vi.fn(),
  reverse: vi.fn(), cancel: vi.fn(), createRail: vi.fn(), transitionRail: vi.fn(),
}));
vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => false, getDb: mocks.database,
}));
vi.mock('../../server/lib/auditLog.js', () => ({ appendCriticalAudit: mocks.audit }));
vi.mock('../../server/lib/rbacMiddleware.js', () => ({ authorizeRecentAdminStepUp: mocks.stepUp }));
vi.mock('../../server/lib/homepageCmsStore.js', () => ({
  defaultHomepageAdminView: vi.fn(), homepageAdminView: vi.fn(),
  mergeHomepageAdminView: vi.fn(), publishHomepageContent: vi.fn(), readHomepageDocument: vi.fn(),
}));
vi.mock('../../server/lib/onboardingStore.js', () => ({
  getOnboardingCaseBundle: mocks.bundle, assertMakerChecker: mocks.makerChecker,
}));
vi.mock('../../server/lib/onboardingProviderStore.js', () => ({ assertProviderVerificationComplete: mocks.provider }));
vi.mock('../../server/lib/emailService.js', () => ({
  sendKycMoreInformationEmail: vi.fn(), sendKycRejectedEmail: vi.fn(), sendKycReviewApprovedEmail: vi.fn(),
}));
vi.mock('../../server/lib/notificationStore.js', () => ({ createNotification: vi.fn() }));
vi.mock('../../server/lib/financialSandboxStore.js', () => ({ financialSandbox: {
  createAccount: mocks.createAccount, transfer: mocks.transfer, adjust: mocks.adjust,
  mock: mocks.mock, reverse: mocks.reverse, cancel: mocks.cancel,
} }));
vi.mock('../../server/lib/moneyMovementSimulation.js', () => ({
  MoneyMovementSimulationError: class extends Error {},
  moneyMovementSimulation: { create: mocks.createRail, transition: mocks.transitionRail },
}));

const controls = ['kycApprovalsEnabled', 'sandboxFinancialControlsEnabled'] as const;
function response() {
  const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}
function request(body: Record<string, unknown>, role = 'SUPER_ADMIN') {
  return { body: { expectedWorkflowVersion: 'initial', ...body }, adminSession: { adminId: 'test-checker', email: 'checker@example.test', role },
    ip: '127.0.0.1', get: () => 'test-request' } as unknown as Request;
}
const review = {
  caseId: 'test-case', decision: 'approved' as const, reason: 'Review synthetic test fixture.',
  expectedVersion: 1, adminId: 'test-checker', adminEmail: 'checker@example.test', adminRole: 'SUPER_ADMIN',
};

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.stepUp.mockReturnValue(true);
  mocks.database.mockImplementation(() => { throw new Error('Database access prohibited in this test'); });
  mocks.bundle.mockResolvedValue({ case: { id: 'test-case', status: 'submitted', version: 1, caseType: 'individual' } });
});

describe('workflow configuration switches', () => {
  it('defaults both switches to false', async () => {
    const { getConfig } = await import('../../server/lib/configStore.js');
    for (const control of controls) expect(getConfig().featureToggles[control]).toBe(false);
  });

  it.each(controls)('rejects non-super-admin enabling %s without changing config', async control => {
    const { default: post } = await import('../../server/api/admin/config/POST.js');
    const { getConfig } = await import('../../server/lib/configStore.js');
    const res = response();
    await post(request({ section: 'featureToggles', data: { [control]: true } }, 'COMPLIANCE_ADMIN'), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(getConfig().featureToggles[control]).toBe(false);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it.each(controls)('requires step-up before enabling %s', async control => {
    mocks.stepUp.mockReturnValue(false);
    const { default: post } = await import('../../server/api/admin/config/POST.js');
    const { getConfig } = await import('../../server/lib/configStore.js');
    await post(request({ section: 'featureToggles', data: { [control]: true } }), response() as unknown as Response);
    expect(mocks.stepUp).toHaveBeenCalledOnce();
    expect(getConfig().featureToggles[control]).toBe(false);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it.each(controls)('enables only %s after authorization and audit', async control => {
    const { default: post } = await import('../../server/api/admin/config/POST.js');
    const { getConfig } = await import('../../server/lib/configStore.js');
    const res = response();
    await post(request({ section: 'featureToggles', data: { [control]: true } }), res as unknown as Response);
    expect(getConfig().featureToggles[control]).toBe(true);
    expect(getConfig().featureToggles[controls.find(key => key !== control)!]).toBe(false);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'admin_workflow_controls_change_authorized',
      meta: { changes: { [control]: { before: false, after: true } }, liveFinancialOperationsUnchanged: true },
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it.each(['true', 1, null])('rejects non-boolean value %s', async value => {
    const { default: post } = await import('../../server/api/admin/config/POST.js');
    const { getConfig } = await import('../../server/lib/configStore.js');
    const res = response();
    await post(request({ section: 'featureToggles', data: { kycApprovalsEnabled: value } }), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(getConfig().featureToggles.kycApprovalsEnabled).toBe(false);
  });

  it('fails closed before saving when the critical audit fails', async () => {
    mocks.audit.mockRejectedValue(new Error('Audit unavailable'));
    const { default: post } = await import('../../server/api/admin/config/POST.js');
    const { getConfig } = await import('../../server/lib/configStore.js');
    const res = response();
    await post(request({ section: 'featureToggles', data: { kycApprovalsEnabled: true } }), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(getConfig().featureToggles.kycApprovalsEnabled).toBe(false);
  });

  it('protects reset and permits an authorized reset to disable both controls', async () => {
    const { default: post } = await import('../../server/api/admin/config/POST.js');
    const store = await import('../../server/lib/configStore.js');
    await store.updateSection('featureToggles', { kycApprovalsEnabled: true, sandboxFinancialControlsEnabled: true });
    const denied = response();
    await post(request({ section: 'featureToggles', action: 'reset' }, 'COMPLIANCE_ADMIN'), denied as unknown as Response);
    expect(denied.status).toHaveBeenCalledWith(403);
    for (const control of controls) expect(store.getConfig().featureToggles[control]).toBe(true);
    await post(request({ section: 'featureToggles', action: 'reset', expectedWorkflowVersion: (await store.readWorkflowState()).version }), response() as unknown as Response);
    for (const control of controls) expect(store.getConfig().featureToggles[control]).toBe(false);
    expect(mocks.stepUp).toHaveBeenCalledOnce();
  });
});

describe('sandbox financial mutation gate', () => {
  it.each(['create_account', 'transfer', 'crypto_transfer', 'mock_transaction', 'adjust', 'reverse', 'cancel', 'create_rail_instruction', 'transition_rail_instruction'])('blocks %s when disabled', async action => {
    const { default: post } = await import('../../server/api/admin/financial-sandbox/POST.js');
    const res = response();
    await post(request({ action }), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SANDBOX_FINANCIAL_CONTROLS_DISABLED' }));
    for (const command of [mocks.createAccount, mocks.transfer, mocks.adjust, mocks.mock, mocks.reverse, mocks.cancel, mocks.createRail, mocks.transitionRail]) expect(command).not.toHaveBeenCalled();
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it('dispatches to the simulation service when enabled', async () => {
    const store = await import('../../server/lib/configStore.js');
    await store.updateSection('featureToggles', { sandboxFinancialControlsEnabled: true });
    mocks.createAccount.mockResolvedValue({ id: 'syn_account_test', synthetic: true });
    const { default: post } = await import('../../server/api/admin/financial-sandbox/POST.js');
    const res = response();
    await post(request({ action: 'create_account', name: 'Test only', type: 'personal', asset: 'GBP' }), res as unknown as Response);
    expect(mocks.createAccount).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 'syn_account_test', synthetic: true });
    expect(store.getConfig().featureToggles.kycApprovalsEnabled).toBe(false);
  });
});

describe('KYC approval gate', () => {
  it('blocks approval before reading or writing a case when disabled', async () => {
    const { decideKycCase } = await import('../../server/lib/kycReviewService.js');
    await expect(decideKycCase(review)).rejects.toMatchObject({ code: 'KYC_APPROVALS_DISABLED' });
    expect(mocks.bundle).not.toHaveBeenCalled();
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it('retains independent-review and provider checks when enabled', async () => {
    const store = await import('../../server/lib/configStore.js');
    await store.updateSection('featureToggles', { kycApprovalsEnabled: true });
    mocks.provider.mockRejectedValue(new Error('Production evidence missing'));
    const { decideKycCase } = await import('../../server/lib/kycReviewService.js');
    await expect(decideKycCase(review)).rejects.toMatchObject({ code: 'PROVIDER_VERIFICATION_REQUIRED' });
    expect(mocks.makerChecker).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-case' }), 'test-checker');
    expect(mocks.provider).toHaveBeenCalledWith('test-case', 'individual');
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it('does not block non-approval review actions with the approval switch', async () => {
    mocks.bundle.mockResolvedValue(null);
    const { decideKycCase } = await import('../../server/lib/kycReviewService.js');
    await expect(decideKycCase({ ...review, decision: 'rejected' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mocks.bundle).toHaveBeenCalledOnce();
    expect(mocks.database).not.toHaveBeenCalled();
  });
});
