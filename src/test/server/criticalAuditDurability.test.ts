import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  configured: vi.fn(() => true),
  returning: vi.fn(),
}));

vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: dependencies.configured,
  getDb: () => ({
    insert: () => ({
      values: () => ({ returning: dependencies.returning }),
    }),
  }),
}));

import { appendCriticalAudit } from '../../server/lib/auditLog.js';

describe('critical audit durability', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dependencies.configured.mockReturnValue(true);
    dependencies.returning.mockResolvedValue([{
      id: 'al_test', adminId: 'admin-test', adminEmail: '', action: 'test_intent',
      target: null, targetId: null, details: null, ip: null, ts: new Date('2026-08-12T12:00:00Z'),
    }]);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    errorSpy.mockRestore();
  });

  it('refuses critical production mutations when PostgreSQL audit storage is absent', async () => {
    process.env.NODE_ENV = 'production';
    dependencies.configured.mockReturnValue(false);

    await expect(appendCriticalAudit({
      event: 'admin_kyc_approve_intent', adminId: 'admin-test', userId: 'user-test',
    })).rejects.toThrow('Critical audit storage is unavailable.');
    expect(dependencies.returning).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      '[audit] critical audit storage unavailable',
      { event: 'admin_kyc_approve_intent', adminId: 'admin-test' },
    );
  });

  it('rethrows PostgreSQL failures after emitting a redacted structured alert', async () => {
    process.env.NODE_ENV = 'production';
    dependencies.returning.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(appendCriticalAudit({
      event: 'admin_transaction_approve_intent', adminId: 'admin-test',
      reason: 'sensitive reason must not be logged', meta: { token: 'must-not-be-logged' },
    })).rejects.toThrow('database unavailable');

    const serializedCalls = JSON.stringify(errorSpy.mock.calls);
    expect(serializedCalls).toContain('critical audit write failed');
    expect(serializedCalls).toContain('Error');
    expect(serializedCalls).not.toContain('database unavailable');
    expect(serializedCalls).not.toContain('sensitive reason');
    expect(serializedCalls).not.toContain('must-not-be-logged');
  });

  it('requires every critical audit call site to await persistence', () => {
    const serverRoot = path.resolve(process.cwd(), 'src/server');
    const files: string[] = [];
    const walk = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const resolved = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(resolved);
        else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(resolved);
      }
    };
    walk(serverRoot);

    const unawaited: string[] = [];
    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, index) => {
        if (line.includes('appendCriticalAudit(')
          && !line.includes('function appendCriticalAudit')
          && !line.includes('await appendCriticalAudit(')) {
          unawaited.push(`${path.relative(process.cwd(), file)}:${index + 1}`);
        }
      });
    }

    expect(unawaited).toEqual([]);
  });
});
