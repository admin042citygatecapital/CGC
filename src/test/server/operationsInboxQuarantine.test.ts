import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertSyntheticOperationsCandidate,
  normalizeOperationsQuarantineIds,
  operationsQuarantineConfirmationSha256,
  quarantineOperationsItems,
} from '../../server/lib/operationsInboxQuarantine.js';

describe('Operations Inbox quarantine controls', () => {
  it('normalizes an exact deterministic ID set and produces its SHA-256 fingerprint', () => {
    expect(normalizeOperationsQuarantineIds([' contact-1 ', 'acceptance-1', 'contact-1']))
      .toEqual(['acceptance-1', 'contact-1']);
    expect(operationsQuarantineConfirmationSha256(['contact-1', 'acceptance-1']))
      .toBe(crypto.createHash('sha256').update('acceptance-1\ncontact-1').digest('hex'));
    expect(() => normalizeOperationsQuarantineIds([])).toThrow(/at least one/i);
    expect(() => normalizeOperationsQuarantineIds(['unsafe id'])).toThrow(/safe identifier/i);
  });

  it('accepts only unlinked records with an exact reserved synthetic address', () => {
    expect(() => assertSyntheticOperationsCandidate({ requester_email: 'buyer-test@example.test', user_id: null, status: 'resolved' })).not.toThrow();
    expect(() => assertSyntheticOperationsCandidate({ requester_email: 'real@example.com', user_id: null, status: 'new' })).toThrow(/@example\.test/i);
    expect(() => assertSyntheticOperationsCandidate({ requester_email: 'test@example.test', user_id: 'usr_real', status: 'new' })).toThrow(/customer identity/i);
    expect(() => assertSyntheticOperationsCandidate({ requester_email: 'test@example.test', user_id: null, status: 'archived' })).toThrow(/already archived/i);
  });

  it('fails closed before backup or database mutation when confirmation is wrong', async () => {
    await expect(quarantineOperationsItems({
      ids: ['contact-1'], confirmationSha256: '0'.repeat(64), expectedItemCount: 1,
      reason: 'Archive a confirmed synthetic Operations Inbox record.', actor: 'admin@example.test',
    })).rejects.toThrow(/confirmation hash/i);
  });

  it('uses append-only snapshots and never deletes Operations Inbox records', () => {
    const migration = readFileSync('src/server/db/migrations/0023_operations_quarantine.sql', 'utf8');
    const implementation = readFileSync('src/server/lib/operationsInboxQuarantine.ts', 'utf8');
    expect(migration).toContain('operations_quarantine_records_append_only');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON operations_quarantine_records');
    expect(implementation).toContain("SET status = 'archived'");
    expect(implementation).not.toMatch(/DELETE\s+FROM\s+operations_items/i);
    expect(implementation).toContain('appendCriticalAudit');
    expect(implementation).toContain('createOperationalBackup');
    expect(implementation).not.toContain('transaction.json(');
    expect(implementation).toContain('::jsonb');
  });
});
