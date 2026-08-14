import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('durable financial rates configuration', () => {
  it('persists configuration and immutable history atomically in PostgreSQL', () => {
    const store = readFileSync('src/server/lib/ratesStore.ts', 'utf8');
    expect(store).toContain("const RATES_CONFIG_KEY = 'financial_rates_config'");
    expect(store).toContain('await sql.begin(async transaction =>');
    expect(store).toContain('INSERT INTO config');
    expect(store).toContain('INSERT INTO rate_fee_history');
    expect(store).not.toContain('appendFileSync');
  });

  it('uses an append-only database history table', () => {
    const migration = readFileSync('src/server/db/migrations/0041_rates_fee_history.sql', 'utf8');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS rate_fee_history');
    expect(migration).toContain('BEFORE UPDATE OR DELETE');
    expect(migration).toContain('rate and fee history is immutable');
  });

  it('loads rates before allowing route execution', () => {
    const entry = readFileSync('src/server/entry.ts', 'utf8');
    const load = entry.indexOf('const ratesConfigReady = loadRatesConfigFromDb()');
    const firstProtectedRoute = entry.indexOf('app.use(removeFingerprinting)');
    expect(load).toBeGreaterThan(-1);
    expect(load).toBeLessThan(firstProtectedRoute);
    expect(entry).toContain('await ratesConfigReady');
  });

  it('routes every administrative mutation through the atomic writer', () => {
    const files = [
      'src/server/api/admin/settings/rates/POST.ts',
      'src/server/api/admin/rates/tx-fees/POST.ts',
      'src/server/api/admin/rates/tier-fees/POST.ts',
      'src/server/api/admin/rates/fx-markup/POST.ts',
      'src/server/api/admin/rates/limits/POST.ts',
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('await applyRatesConfigChange');
      expect(source, file).not.toContain('writeRatesConfig');
      expect(source, file).not.toContain('appendFeeHistory');
    }
  });
});
