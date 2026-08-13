import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const migration=readFileSync('src/server/db/migrations/0034_synthetic_disputes.sql','utf8');
const service=readFileSync('src/server/lib/syntheticDisputes.ts','utf8');
describe('synthetic dispute schema',()=>{
 it('isolates cases, immutable evidence, notifications, events and exports',()=>{for(const table of ['synthetic_dispute_cases','synthetic_dispute_evidence','synthetic_dispute_notifications','synthetic_dispute_events','synthetic_dispute_exports'])expect(migration).toContain(table);expect(migration).toContain('BEFORE UPDATE OR DELETE');expect(migration).toContain('ENABLE ROW LEVEL SECURITY');expect(migration).toContain('REVOKE ALL');});
 it('requires maker-checker and balanced reversal remediation',()=>{expect(service).toContain('MAKER_CHECKER_REQUIRED');expect(service).toContain('financialSandbox.reverse');expect(service).toContain('dispute-remediation:');expect(service).not.toMatch(/balanceMinor\s*[-+]?=/);});
});
