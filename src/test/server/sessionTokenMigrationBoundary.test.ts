import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('session token digest migration boundary', () => {
  it('revokes ephemeral credentials, renames only expected columns, and is manually idempotent', () => {
    const migration = readFileSync(
      'src/server/db/migrations/0049_session_token_digests.sql',
      'utf8',
    );

    expect(migration).toMatch(/DELETE FROM admin_sessions/i);
    expect(migration).toMatch(/DELETE FROM customer_sessions/i);
    expect(migration).toMatch(/DELETE FROM config WHERE key = 'trusted_devices'/i);
    expect(migration).toMatch(/ALTER TABLE admin_sessions RENAME COLUMN token TO token_hash/i);
    expect(migration).toMatch(/ALTER TABLE customer_sessions RENAME COLUMN token TO token_hash/i);
    expect(migration).toMatch(/already present; no revocation required/i);
    expect(migration).not.toMatch(/(?:DELETE|TRUNCATE)\s+(?:FROM\s+)?(?:users|accounts|transactions|journal_entries|journal_lines|kyc_cases)\b/i);
  });

  it('never imports historical administrator bearer credentials', () => {
    const importer = readFileSync('src/server/db/importFlatFiles.ts', 'utf8');
    const section = importer.slice(
      importer.indexOf('async function migrateAdminSessions()'),
      importer.indexOf('// ── Main'),
    );

    expect(section).toMatch(/securely skipped/i);
    expect(section).not.toMatch(/INSERT INTO admin_sessions/i);
    expect(section).not.toMatch(/token\.slice|\$\{token\}/i);
  });
});
