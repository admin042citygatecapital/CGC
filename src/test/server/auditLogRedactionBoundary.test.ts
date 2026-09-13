import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let root = '';
let originalDatabaseUrl: string | undefined;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-audit-redaction-'));
  originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.PRIVATE_DATA_ROOT = root;
  vi.resetModules();
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.PRIVATE_DATA_ROOT;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

/**
 * Redaction must apply at the lowest-level writer: appendAuditEntry persists
 * records from call sites that never pass through the legacy appendAudit
 * helper, so the sensitive-key boundary has to live where every record is
 * stored regardless of which entry point the caller used.
 */
describe('audit redaction boundary', () => {
  it('redacts secret-shaped keys in entries appended directly to the store', async () => {
    const audit = await import('../../server/lib/auditLog.js');
    await audit.appendAuditEntry({
      adminId: 'admin-redaction-boundary',
      adminEmail: 'redaction@example.test',
      action: 'direct_entry_write',
      target: 'integration',
      targetId: 'int_1',
      details: {
        provider: 'smtp',
        password: 'plaintext-password',
        apiToken: 'plaintext-token',
        otp: '123456',
        card: '4242424242424242',
        harmless: 'plain-metadata',
      },
      ip: '192.0.2.10',
    });

    const entries = await audit.getAuditLog({ adminId: 'admin-redaction-boundary' });
    const record = entries.find(entry => entry.action === 'direct_entry_write');
    expect(record).toBeDefined();
    expect(record?.details).toMatchObject({
      provider: 'smtp',
      password: '[redacted]',
      apiToken: '[redacted]',
      otp: '[redacted]',
      card: '[redacted]',
      harmless: 'plain-metadata',
    });
    expect(JSON.stringify(record)).not.toContain('plaintext-password');
    expect(JSON.stringify(record)).not.toContain('plaintext-token');
    expect(JSON.stringify(record)).not.toContain('123456');
    expect(JSON.stringify(record)).not.toContain('4242424242');
  });
});