import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies=vi.hoisted(()=>({
  authorizeRecentAdminStepUp:vi.fn().mockReturnValue(true),
  getLatestOnboardingCaseForUser:vi.fn(),
  activateCustomerAfterKyc:vi.fn(),
  sendFinalActivationEmail:vi.fn(),
}));
vi.mock('../../server/lib/rbacMiddleware.js',()=>({authorizeRecentAdminStepUp:dependencies.authorizeRecentAdminStepUp}));
vi.mock('../../server/lib/onboardingStore.js',()=>({getLatestOnboardingCaseForUser:dependencies.getLatestOnboardingCaseForUser}));
vi.mock('../../server/lib/finalCustomerActivation.js',()=>({activateCustomerAfterKyc:dependencies.activateCustomerAfterKyc}));
vi.mock('../../server/lib/emailService.js',()=>({sendFinalActivationEmail:dependencies.sendFinalActivationEmail}));
import handler from '../../server/api/admin/users/approve/POST.js';

const admin={adminId:'super-1',email:'admin@example.test',role:'SUPER_ADMIN'};
const onboardingCase={id:'oc-test',caseType:'individual' as const,version:9};
function response(){const res={status:vi.fn(),json:vi.fn()};res.status.mockReturnValue(res);res.json.mockReturnValue(res);return res;}
function request(role='SUPER_ADMIN'){return {body:{userId:'usr-test',reason:'All provider controls were reviewed.',expectedCaseVersion:9},ip:'127.0.0.1',headers:{'x-request-id':'req-final'},adminSession:{...admin,role}};}

describe('controlled final customer activation',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    dependencies.authorizeRecentAdminStepUp.mockReturnValue(true);
    dependencies.getLatestOnboardingCaseForUser.mockResolvedValue(onboardingCase);
    dependencies.activateCustomerAfterKyc.mockResolvedValue({customer:{id:'usr-test',email:'customer@example.test',name:'Test Customer'},revokedSessionCount:4,credentialVersion:2});
  });
  it('requires SUPER_ADMIN and recent step-up',async()=>{
    const wrong=response();await handler(request('COMPLIANCE_ADMIN') as never,wrong as never);expect(wrong.status).toHaveBeenCalledWith(403);
    dependencies.authorizeRecentAdminStepUp.mockReturnValue(false);
    await handler(request() as never,response() as never);expect(dependencies.activateCustomerAfterKyc).not.toHaveBeenCalled();
  });
  it('activates through the transaction service and sends email only after commit',async()=>{
    const res=response();await handler(request() as never,res as never);
    expect(dependencies.activateCustomerAfterKyc).toHaveBeenCalledWith(expect.objectContaining({userId:'usr-test',caseId:'oc-test',caseType:'individual',expectedCaseVersion:9,adminRole:'SUPER_ADMIN'}));
    expect(dependencies.sendFinalActivationEmail).toHaveBeenCalledWith('customer@example.test','Test Customer');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ok:true,revokedSessionCount:4}));
  });
  it('does not queue final email when activation fails closed',async()=>{
    dependencies.activateCustomerAfterKyc.mockRejectedValue(Object.assign(new Error('Provider required'),{code:'PROVIDER_VERIFICATION_REQUIRED'}));
    const res=response();await handler(request() as never,res as never);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(dependencies.sendFinalActivationEmail).not.toHaveBeenCalled();
  });
  it('keeps activation, credential invalidation, session revocation and audit in one database transaction',()=>{
    const source=readFileSync('src/server/lib/finalCustomerActivation.ts','utf8');
    const body=source.slice(source.indexOf('getDb().transaction'));
    expect(body).toContain('tx.update(users)');
    expect(body).toContain('tx.delete(customerSessions)');
    expect(body).toContain('tx.insert(onboardingEvents)');
    expect(body).toContain('tx.insert(auditLog)');
  });
});
