import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const migration=readFileSync('src/server/db/migrations/0033_synthetic_reconciliation.sql','utf8');
const service=readFileSync('src/server/lib/syntheticReconciliation.ts','utf8');
const api=readFileSync('src/server/api/admin/reconciliation/POST.ts','utf8');
describe('synthetic reconciliation boundaries',()=>{
  it('defines isolated immutable snapshots, events and exports',()=>{for(const table of ['synthetic_reconciliation_runs','synthetic_reconciliation_items','synthetic_reconciliation_exceptions','synthetic_reconciliation_events','synthetic_reconciliation_exports'])expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);expect(migration).toContain('synthetic reconciliation snapshots are immutable');expect(migration).toContain('BEFORE UPDATE OR DELETE ON synthetic_reconciliation_runs');expect(migration).toContain('BEFORE UPDATE OR DELETE ON synthetic_reconciliation_items');expect(migration).toContain('BEFORE UPDATE OR DELETE ON synthetic_reconciliation_events');expect(migration).toContain('REVOKE ALL ON synthetic_reconciliation_runs');});
  it('cannot mutate balances or enable live operations',()=>{expect(service).not.toMatch(/UPDATE financial_sandbox_accounts/i);expect(service).not.toMatch(/ENABLE_FINANCIAL_OPERATIONS\s*=/i);expect(service).toContain("liveProviderAdaptersImplemented:false");expect(api).not.toMatch(/balanceMinor\s*=/);expect(api).not.toMatch(/financialOperationsEnabled/);});
  it('provides maker-checker, SHA-256 evidence and all required break classes',()=>{for(const outcome of ['missing_transaction','missing_provider_instruction','missing_journal','duplicate_reference','amount_mismatch','asset_mismatch','unbalanced_journal'])expect(service).toContain(outcome);expect(service).toContain('MAKER_CHECKER_REQUIRED');expect(service).toContain("actorType!=='independent_checker'");expect(service).toContain("createHash('sha256')");});
});
