import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  normalizeTestEmails, quarantineConfirmationSha256, quarantineTestData,
} from '../../server/lib/dataQuarantine.js';

describe('production test-data quarantine controls', () => {
  it('accepts only exact identities on reserved test domains', () => {
    expect(normalizeTestEmails([
      ' Test.User@Example.com ', 'test.user@example.com', 'browser@e2e.test', 'preview@citygate.local',
    ])).toEqual(['browser@e2e.test', 'preview@citygate.local', 'test.user@example.com']);
    expect(() => normalizeTestEmails(['customer@gmail.com'])).toThrow(/reserved test domains/i);
    expect(() => normalizeTestEmails([])).toThrow(/at least one/i);
  });

  it('produces a deterministic confirmation fingerprint over the exact sorted set', () => {
    const expected = crypto.createHash('sha256')
      .update('a@example.com\nz@example.com')
      .digest('hex');
    expect(quarantineConfirmationSha256(['z@example.com', 'a@example.com'])).toBe(expected);
  });

  it('fails closed before database access when fresh provider backup verification is absent', async () => {
    await expect(quarantineTestData({
      emails: ['test@example.com'], confirmationSha256: quarantineConfirmationSha256(['test@example.com']),
      providerBackupReference: 'backup-123', reason: 'Quarantine approved test identity.',
      providerBackupVerifiedAt: '',
      expectedCustomerCount: 1, expectedTransactionCount: 0,
      actor: 'admin@example.test',
    })).rejects.toThrow(/backup verification/i);
  });

  it('uses append-only snapshots and never deletes customer or transaction history', () => {
    const migration = readFileSync('src/server/db/migrations/0017_data_quarantine.sql', 'utf8');
    const forwardMigration = readFileSync('src/server/db/migrations/0019_quarantine_backup_verification.sql', 'utf8');
    expect(migration).toContain('data_quarantine_records_append_only');
    expect(migration).toContain('provider_backup_verified_at TIMESTAMPTZ NOT NULL');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON data_quarantine_records');
    expect(migration).not.toMatch(/DELETE\s+FROM\s+(users|transactions)/i);
    expect(forwardMigration).toContain('ALTER COLUMN provider_backup_verified_at SET NOT NULL');
    expect(forwardMigration).not.toMatch(/UPDATE\s+data_quarantine_batches/i);
  });
});
