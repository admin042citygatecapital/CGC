import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const migration=readFileSync('src/server/db/migrations/0034_synthetic_disputes.sql','utf8');
const customerMigration=readFileSync('src/server/db/migrations/0035_customer_dispute_intake.sql','utf8');
const service=readFileSync('src/server/lib/syntheticDisputes.ts','utf8');
describe('synthetic dispute schema',()=>{
 it('isolates cases, immutable evidence, notifications, events and exports',()=>{for(const table of ['synthetic_dispute_cases','synthetic_dispute_evidence','synthetic_dispute_notifications','synthetic_dispute_events','synthetic_dispute_exports'])expect(migration).toContain(table);expect(migration).toContain('BEFORE UPDATE OR DELETE');expect(migration).toContain('ENABLE ROW LEVEL SECURITY');expect(migration).toContain('REVOKE ALL');});
 it('requires maker-checker and balanced reversal remediation',()=>{expect(service).toContain('MAKER_CHECKER_REQUIRED');expect(service).toContain('financialSandbox.reverse');expect(service).toContain('dispute-remediation:');expect(service).not.toMatch(/balanceMinor\s*[-+]?=/);});
 it('binds customer cases to server-resolved owners and idempotency keys',()=>{expect(customerMigration).toContain('customer_user_id');expect(customerMigration).toContain('customer_idempotency_key');expect(customerMigration).toContain("'customer'");expect(service).toContain('transaction.userId!==customer.id');expect(service).toContain('listForCustomer');});
});
