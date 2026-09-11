import { describe,expect,it } from 'vitest';
import { assertAssuranceAcceptable,assertAssuranceRole,assertAssuranceSubmittable,validateAssuranceInput } from '../../server/lib/assuranceExerciseStore.js';

// The stored row shapes the lifecycle guards consume; fixtures reuse the input
// literal (string dates) so the double cast keeps runtime values unchanged.
type SubmittableRow = Parameters<typeof assertAssuranceSubmittable>[0];
type AcceptableRow = Parameters<typeof assertAssuranceAcceptable>[0];

const valid={kind:'penetration_test' as const,title:'Independent application penetration test',scope:'Authenticated web, API, administration and infrastructure testing.',owner:'Security',provider:'Independent Assessor',outcome:'passed' as const,evidenceUrl:'https://evidence.example/reports/pt-001',evidenceSha256:'a'.repeat(64),startedAt:'2026-08-01',completedAt:'2026-08-02',expiresAt:'2027-08-02',criticalFindings:0,highFindings:0,openFindings:0,notes:'Retest completed.'};
describe('assurance exercise controls',()=>{
 it('validates controlled evidence metadata',()=>{const value=validateAssuranceInput(valid);expect(value.evidenceSha256).toHaveLength(64);expect(value.completedAt?.toISOString()).toContain('2026-08-02');});
 it('rejects credential URLs and invalid finding counts',()=>{expect(()=>validateAssuranceInput({...valid,evidenceUrl:'https://user:pass@example.com/report'})).toThrow(/credentials/);expect(()=>validateAssuranceInput({...valid,openFindings:-1})).toThrow(/non-negative/);});
 it('enforces category ownership',()=>{expect(()=>assertAssuranceRole('penetration_test','COMPLIANCE_ADMIN')).toThrow(/does not own/);expect(()=>assertAssuranceRole('compliance_acceptance','SECURITY_ADMIN')).toThrow(/does not own/);expect(()=>assertAssuranceRole('disaster_recovery','SUPER_ADMIN')).not.toThrow();});
 it('requires complete hashed evidence before submission',()=>{expect(()=>assertAssuranceSubmittable({...valid,evidenceUrl:null} as unknown as SubmittableRow)).toThrow(/required/);expect(()=>assertAssuranceSubmittable(valid as unknown as SubmittableRow)).not.toThrow();});
 it('requires remediation closure before acceptance',()=>{expect(()=>assertAssuranceAcceptable({...valid,outcome:'passed_with_findings',openFindings:1} as unknown as AcceptableRow)).toThrow(/zero open findings/);expect(()=>assertAssuranceAcceptable(valid as unknown as AcceptableRow)).not.toThrow();});
});
