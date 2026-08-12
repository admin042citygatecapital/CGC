import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  findUserById: vi.fn(), updateUser: vi.fn(), appendAudit: vi.fn(), appendCriticalAudit: vi.fn(), appendKycNote: vi.fn(),
  sendMail: vi.fn().mockResolvedValue({ success: true }),
  sendApprovalEmail: vi.fn().mockResolvedValue(undefined),
  sendRejectionEmail: vi.fn().mockResolvedValue(undefined),
  getLatestOnboardingCaseForUser: vi.fn(), reviewOnboardingCase: vi.fn(),
  getOrCreateOnboardingCase: vi.fn(), submitOnboardingCase: vi.fn(),
  createNotification: vi.fn(), assertProviderVerificationComplete: vi.fn(),
}));

vi.mock('../../server/lib/userStore.js', () => ({
  findUserById: dependencies.findUserById, updateUser: dependencies.updateUser,
}));
vi.mock('../../server/lib/auditLog.js', () => ({ appendAudit: dependencies.appendAudit, appendCriticalAudit: dependencies.appendCriticalAudit }));
vi.mock('../../server/lib/kycStore.js', () => ({ appendKycNote: dependencies.appendKycNote }));
vi.mock('../../server/lib/emailService.js', () => ({
  sendMail: dependencies.sendMail,
  sendApprovalEmail: dependencies.sendApprovalEmail,
  sendRejectionEmail: dependencies.sendRejectionEmail,
}));
vi.mock('../../server/lib/onboardingStore.js', () => ({
  getLatestOnboardingCaseForUser: dependencies.getLatestOnboardingCaseForUser,
  reviewOnboardingCase: dependencies.reviewOnboardingCase,
  getOrCreateOnboardingCase: dependencies.getOrCreateOnboardingCase,
  submitOnboardingCase: dependencies.submitOnboardingCase,
}));
vi.mock('../../server/lib/notificationStore.js', () => ({ createNotification: dependencies.createNotification }));
vi.mock('../../server/lib/onboardingProviderStore.js', () => ({
  assertProviderVerificationComplete: dependencies.assertProviderVerificationComplete,
}));

import approveKyc from '../../server/api/admin/kyc/approve/POST.js';
import rejectKyc from '../../server/api/admin/kyc/reject/POST.js';
import requestKycInfo from '../../server/api/admin/kyc/request-info/POST.js';
import submitKyc from '../../server/api/users/onboarding/submit/POST.js';

const user = { id: 'customer-kyc-1', email: 'kyc@example.test', name: 'KYC <Customer>' };
const onboardingCase = { id: 'case-kyc-1', caseType: 'individual' as const };
const adminSession = { adminId: 'super-admin-checker', email: 'admin@citygate.capital', role: 'super_admin' };

function request(body: Record<string, unknown>) {
  return { body, adminSession, ip: '127.0.0.1' } as unknown as Request;
}
function responseDouble() {
  const state: { status: number; body?: unknown } = { status: 200 };
  const res = {
    status(code: number) { state.status = code; return this; },
    json(body: unknown) { state.body = body; return this; },
  } as unknown as Response;
  return { res, state };
}

describe('super-administrator KYC lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.findUserById.mockResolvedValue(user);
    dependencies.getLatestOnboardingCaseForUser.mockResolvedValue(onboardingCase);
    dependencies.reviewOnboardingCase.mockResolvedValue({ ...onboardingCase, status: 'approved' });
    dependencies.getOrCreateOnboardingCase.mockResolvedValue(onboardingCase);
    dependencies.submitOnboardingCase.mockResolvedValue({ ...onboardingCase, status: 'submitted' });
    dependencies.assertProviderVerificationComplete.mockResolvedValue(undefined);
    dependencies.appendCriticalAudit.mockResolvedValue(undefined);
  });

  it('submits a customer case for review without activating financial services', async () => {
    const result = responseDouble();
    const customerRequest = { customerUser: { ...user, accountTier: 'personal' } } as unknown as Request;
    await submitKyc(customerRequest, result.res);

    expect(dependencies.getOrCreateOnboardingCase).toHaveBeenCalledWith(user.id, 'individual', user.id);
    expect(dependencies.submitOnboardingCase).toHaveBeenCalledWith(onboardingCase.id, user.id, user.id, 'customer');
    expect(dependencies.updateUser).toHaveBeenCalledWith(user.id, expect.objectContaining({
      status: 'pending_kyc', kycStatus: 'submitted',
    }));
    expect(dependencies.createNotification).toHaveBeenCalledWith(
      user.id,
      'Onboarding submitted',
      expect.stringMatching(/does not activate financial services/i),
      '/kyc',
    );
    expect(result.state).toMatchObject({ status: 200, body: { ok: true, case: { status: 'submitted' } } });
  });

  it('cannot approve KYC without accepted provider identity and screening results', async () => {
    dependencies.assertProviderVerificationComplete.mockRejectedValue(
      Object.assign(new Error('Approved provider screening is required.'), { code: 'PROVIDER_SCREENING_REQUIRED' }),
    );
    const result = responseDouble();
    await approveKyc(request({ userId: user.id, note: 'Reviewed provider evidence and screening.' }), result.res);

    expect(result.state).toMatchObject({ status: 409, body: { code: 'PROVIDER_SCREENING_REQUIRED' } });
    expect(dependencies.reviewOnboardingCase).not.toHaveBeenCalled();
    expect(dependencies.updateUser).not.toHaveBeenCalled();
  });

  it('approves only after provider verification and leaves AML and financial activation pending', async () => {
    const result = responseDouble();
    await approveKyc(request({ userId: user.id, note: 'Reviewed provider evidence and screening.' }), result.res);

    expect(dependencies.assertProviderVerificationComplete).toHaveBeenCalledWith(onboardingCase.id, 'individual');
    expect(dependencies.reviewOnboardingCase).toHaveBeenCalledWith(expect.objectContaining({
      caseId: onboardingCase.id, reviewerId: adminSession.adminId, decision: 'approved',
    }));
    expect(dependencies.updateUser).toHaveBeenCalledWith(user.id, expect.objectContaining({
      status: 'pending_approval', kycStatus: 'approved', amlStatus: 'pending',
      kycReviewedBy: adminSession.adminId,
    }));
    expect(dependencies.appendAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin_kyc_approve' }));
    expect(dependencies.appendCriticalAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin_kyc_approve_intent' }));
  });

  it('moves the case to needs-information, audits it, and escapes email content', async () => {
    const result = responseDouble();
    await requestKycInfo(request({ userId: user.id, message: 'Please provide <script>alert(1)</script> proof of address.' }), result.res);

    expect(dependencies.reviewOnboardingCase).toHaveBeenCalledWith(expect.objectContaining({
      caseId: onboardingCase.id, decision: 'needs_info', reviewerId: adminSession.adminId,
    }));
    expect(dependencies.updateUser).toHaveBeenCalledWith(user.id, { status: 'pending_kyc', kycStatus: 'submitted' });
    const email = dependencies.sendMail.mock.calls[0][0] as { html: string };
    expect(email.html).not.toContain('<script>');
    expect(email.html).not.toContain('<Customer>');
    expect(dependencies.appendAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin_kyc_request_info' }));
    expect(dependencies.appendCriticalAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin_kyc_request_info_intent' }));
  });

  it('rejects through the versioned case lifecycle with an immutable audit event', async () => {
    const result = responseDouble();
    await rejectKyc(request({ userId: user.id, reason: 'Identity evidence could not be validated.', reasonCode: 'invalid_document' }), result.res);

    expect(dependencies.reviewOnboardingCase).toHaveBeenCalledWith(expect.objectContaining({
      caseId: onboardingCase.id, decision: 'rejected', reviewerId: adminSession.adminId,
    }));
    expect(dependencies.updateUser).toHaveBeenCalledWith(user.id, expect.objectContaining({
      status: 'rejected', kycStatus: 'rejected',
    }));
    expect(dependencies.appendAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin_kyc_reject' }));
    expect(dependencies.appendCriticalAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin_kyc_reject_intent' }));
  });

  it('fails closed when the critical audit intent cannot be persisted', async () => {
    dependencies.appendCriticalAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    const result = responseDouble();
    await expect(approveKyc(request({ userId: user.id, note: 'Reviewed provider evidence and screening.' }), result.res))
      .rejects.toThrow('audit unavailable');
    expect(dependencies.reviewOnboardingCase).not.toHaveBeenCalled();
    expect(dependencies.updateUser).not.toHaveBeenCalled();
  });
});
