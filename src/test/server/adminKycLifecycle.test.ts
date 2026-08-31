import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  authorizeRecentAdminStepUp: vi.fn().mockReturnValue(true),
  getLatestOnboardingCaseForUser: vi.fn(),
  getOrCreateOnboardingCase: vi.fn(),
  submitOnboardingCase: vi.fn(),
  decideKycCase: vi.fn(),
  createNotification: vi.fn(),
  sendKycSubmittedEmail: vi.fn(),
}));
vi.mock('../../server/lib/rbacMiddleware.js', () => ({ authorizeRecentAdminStepUp: dependencies.authorizeRecentAdminStepUp }));
vi.mock('../../server/lib/onboardingStore.js', () => ({
  getLatestOnboardingCaseForUser: dependencies.getLatestOnboardingCaseForUser,
  getOrCreateOnboardingCase: dependencies.getOrCreateOnboardingCase,
  submitOnboardingCase: dependencies.submitOnboardingCase,
}));
vi.mock('../../server/lib/kycReviewService.js', () => ({ decideKycCase: dependencies.decideKycCase }));
vi.mock('../../server/lib/notificationStore.js', () => ({ createNotification: dependencies.createNotification }));
vi.mock('../../server/lib/emailService.js', () => ({ sendKycSubmittedEmail: dependencies.sendKycSubmittedEmail }));

import approveKyc from '../../server/api/admin/kyc/approve/POST.js';
import rejectKyc from '../../server/api/admin/kyc/reject/POST.js';
import requestKycInfo from '../../server/api/admin/kyc/request-info/POST.js';
import submitKyc from '../../server/api/users/onboarding/submit/POST.js';

const user = { id:'customer-kyc-1', email:'kyc@example.test', name:'KYC Customer', accountTier:'personal' };
const onboardingCase = { id:'case-kyc-1', caseType:'individual' as const, version:7 };
const adminSession = { adminId:'admin-checker', email:'admin@citygate.capital', role:'SUPER_ADMIN' };
function responseDouble() {
  const state:{status:number;body?:unknown}={status:200};
  const res={status(code:number){state.status=code;return this;},json(body:unknown){state.body=body;return this;}} as unknown as Response;
  return {res,state};
}
function request(body:Record<string,unknown>){return {body,adminSession,ip:'127.0.0.1',headers:{'x-request-id':'req-1'}} as unknown as Request;}

describe('canonical KYC lifecycle routes',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    dependencies.authorizeRecentAdminStepUp.mockReturnValue(true);
    dependencies.getLatestOnboardingCaseForUser.mockResolvedValue(onboardingCase);
    dependencies.getOrCreateOnboardingCase.mockResolvedValue(onboardingCase);
    dependencies.submitOnboardingCase.mockResolvedValue({...onboardingCase,status:'submitted',submissionReplayed:false});
    dependencies.decideKycCase.mockResolvedValue({case:{...onboardingCase,status:'approved'}});
  });
  it('submits atomically with case version and idempotency key, then queues one notice',async()=>{
    const result=responseDouble();
    await submitKyc({customerUser:user,body:{caseVersion:7,idempotencyKey:'test-idempotency-value'}} as unknown as Request,result.res);
    expect(dependencies.submitOnboardingCase).toHaveBeenCalledWith(onboardingCase.id,user.id,user.id,'customer',7,'test-idempotency-value');
    expect(dependencies.createNotification).toHaveBeenCalledOnce();
    expect(dependencies.sendKycSubmittedEmail).toHaveBeenCalledOnce();
    expect(result.state.status).toBe(200);
  });
  it('does not duplicate notification or email for an idempotent replay',async()=>{
    dependencies.submitOnboardingCase.mockResolvedValue({...onboardingCase,status:'submitted',submissionReplayed:true});
    await submitKyc({customerUser:user,body:{caseVersion:7,idempotencyKey:'test-idempotency-value'}} as unknown as Request,responseDouble().res);
    expect(dependencies.createNotification).not.toHaveBeenCalled();
    expect(dependencies.sendKycSubmittedEmail).not.toHaveBeenCalled();
  });
  it('keeps approval fail-closed when canonical provider verification rejects',async()=>{
    dependencies.decideKycCase.mockRejectedValue(Object.assign(new Error('Provider required'),{code:'PROVIDER_VERIFICATION_REQUIRED'}));
    const result=responseDouble();
    await approveKyc(request({userId:user.id,note:'Reviewed evidence and screening.',expectedVersion:7}),result.res);
    expect(result.state).toMatchObject({status:409,body:{code:'PROVIDER_VERIFICATION_REQUIRED'}});
  });
  it('uses one versioned service for approval, rejection, and more information',async()=>{
    await approveKyc(request({userId:user.id,note:'Provider evidence is complete.',expectedVersion:7}),responseDouble().res);
    await rejectKyc(request({userId:user.id,reason:'Evidence could not be validated.',reasonCode:'other',expectedVersion:7}),responseDouble().res);
    await requestKycInfo(request({userId:user.id,message:'Please upload a clearer address document.',reasonCode:'unreadable',requestedEvidenceKinds:['proof_of_address'],expectedVersion:7}),responseDouble().res);
    expect(dependencies.decideKycCase).toHaveBeenNthCalledWith(1,expect.objectContaining({decision:'approved',expectedVersion:7}));
    expect(dependencies.decideKycCase).toHaveBeenNthCalledWith(2,expect.objectContaining({decision:'rejected',expectedVersion:7}));
    expect(dependencies.decideKycCase).toHaveBeenNthCalledWith(3,expect.objectContaining({decision:'needs_info',requestedEvidenceKinds:['proof_of_address'],expectedVersion:7}));
  });
  it('requires recent administrator step-up before every decision',async()=>{
    dependencies.authorizeRecentAdminStepUp.mockReturnValue(false);
    await approveKyc(request({userId:user.id}),responseDouble().res);
    expect(dependencies.decideKycCase).not.toHaveBeenCalled();
  });
});
