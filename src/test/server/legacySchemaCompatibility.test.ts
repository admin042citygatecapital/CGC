import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  'src/server/db/migrations/0000_legacy_schema_compatibility.sql',
);
const migration = fs.readFileSync(migrationPath, 'utf8');
const pendingAccessLogMigrationPath = path.resolve(
  process.cwd(),
  'src/server/db/migrations/0002_access_log_brute_force.sql',
);
const pendingAccessLogMigration = fs.readFileSync(pendingAccessLogMigrationPath, 'utf8');

describe('legacy schema compatibility migration', () => {
  it('runs before the initial schema and remains safe to repeat', () => {
    expect(path.basename(migrationPath)).toBe('0000_legacy_schema_compatibility.sql');
    expect(migration).toContain("to_regclass('public.users')");
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS');
  });

  it('bridges the legacy aliases required by the canonical schema', () => {
    expect(migration).toContain('SET ua = user_agent');
    expect(migration).toContain('SET ts = created_at');
    expect(migration).toContain('SET duration = duration_ms');
    expect(migration).toContain('SET target = resource_type');
    expect(migration).toContain('SET scheduled_at = created_at');
    expect(migration).toContain('SET wallet_address = crypto_address');
  });

  it('does not remove data or forge migration history', () => {
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE)\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/(?:INSERT|UPDATE)\s+(?:INTO\s+)?(?:public\.)?schema_migrations/i);
  });

  it('does not mutate balances or financial amounts', () => {
    expect(migration).not.toMatch(/SET\s+balance\s*=/i);
    expect(migration).not.toMatch(/SET\s+amount\s*=/i);
  });

  it('reconciles a legacy access_log before the pending canonical indexes run', () => {
    const addTs = pendingAccessLogMigration.indexOf('ADD COLUMN IF NOT EXISTS ts');
    const createTsIndex = pendingAccessLogMigration.indexOf('CREATE INDEX IF NOT EXISTS access_log_ts_idx');

    expect(addTs).toBeGreaterThan(-1);
    expect(createTsIndex).toBeGreaterThan(addTs);
    expect(pendingAccessLogMigration).toContain('SET ts = created_at');
    expect(pendingAccessLogMigration).toContain('SET duration = duration_ms');
    expect(pendingAccessLogMigration).toContain('SET ua = user_agent');
    expect(pendingAccessLogMigration).not.toMatch(/\b(?:DROP|TRUNCATE)\b/i);
    expect(pendingAccessLogMigration).not.toMatch(/\bDELETE\s+FROM\b/i);
  });
});
