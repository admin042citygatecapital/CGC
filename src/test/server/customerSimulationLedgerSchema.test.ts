import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'src/server/db/migrations/0030_customer_simulation_ledger.sql',
  'utf8',
);

describe('customer simulation ledger schema', () => {
  it('creates customer ledger accounts, immutable journals and idempotent commands', () => {
    for (const table of [
      'customer_ledger_accounts',
      'customer_simulation_transactions',
      'customer_simulation_journal_entries',
      'customer_simulation_journal_lines',
      'customer_simulation_commands',
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
      expect(migration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`REVOKE ALL ON TABLE ${table} FROM PUBLIC`);
    }
    expect(migration).toContain('PRIMARY KEY (actor_scope, idempotency_key)');
    expect(migration).toContain('Customer simulation journal records are immutable');
  });

  it('enforces balanced, single-currency, simulation-only entries', () => {
    expect(migration).toContain('debit_total <> credit_total OR currency_count <> 1');
    expect(migration).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(migration).toContain("CHECK (execution_source = 'SIMULATION')");
    expect(migration).toContain('CHECK (synthetic IS TRUE)');
  });

  it('contains no provider, custody, bank-routing or verification fields', () => {
    expect(migration).not.toMatch(/provider_account|custody_address|iban|swift|routing_number/i);
    expect(migration).not.toMatch(/kyc_provider|aml_provider|financial_institution/i);
  });
});
