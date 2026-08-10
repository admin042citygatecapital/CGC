import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';

let root = '';

afterEach(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
  root = '';
  delete process.env.PRIVATE_DATA_ROOT;
  delete process.env.BACKUP_DIRECTORY;
  delete process.env.ENABLE_LOCAL_OPERATIONAL_BACKUPS;
  vi.doUnmock('../../server/db/db.js');
  vi.resetModules();
});

describe('operational backup', () => {
  it('writes an atomic gzip snapshot with a verifiable checksum', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-backup-'));
    process.env.PRIVATE_DATA_ROOT = root;
    process.env.BACKUP_DIRECTORY = path.join(root, 'backups');
    process.env.ENABLE_LOCAL_OPERATIONAL_BACKUPS = '1';
    const row = {
      id: 'op_1', source: 'contact_form', referenceId: 'ref_1', title: 'Question', summary: 'Help',
      requesterName: 'Customer', requesterEmail: 'customer@example.test', userId: null,
      status: 'new', priority: 'normal', assignedTo: null, adminNotes: [], metadata: {}, history: [],
      createdAt: new Date('2026-08-10T00:00:00Z'), updatedAt: new Date('2026-08-10T00:00:00Z'),
    };
    vi.doMock('../../server/db/db.js', () => ({
      isDatabaseConfigured: () => true,
      getDb: () => ({ select: () => ({ from: () => ({ orderBy: async () => [row] }) }) }),
    }));
    const backup = await import('../../server/lib/operationalBackup.js');
    const result = await backup.createOperationalBackup();
    expect(result.count).toBe(1);
    const bytes = fs.readFileSync(result.file);
    expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(result.checksum);
    const payload = JSON.parse(zlib.gunzipSync(bytes).toString('utf8'));
    expect(payload).toMatchObject({ format: 'cgc-operations-backup', version: 1, count: 1 });
    expect(backup.getOperationalBackupStatus()).toMatchObject({ enabled: true, checksumValid: true });
  });

  it('rejects a backup directory outside private storage', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-backup-'));
    process.env.PRIVATE_DATA_ROOT = root;
    process.env.BACKUP_DIRECTORY = path.join(os.tmpdir(), 'outside-cgc-backup');
    vi.doMock('../../server/db/db.js', () => ({ isDatabaseConfigured: () => true, getDb: vi.fn() }));
    const backup = await import('../../server/lib/operationalBackup.js');
    await expect(backup.createOperationalBackup()).rejects.toThrow('inside PRIVATE_DATA_ROOT');
  });
});
