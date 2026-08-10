import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let root = '';

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-private-root-'));
  process.env.PRIVATE_DATA_ROOT = root;
  vi.resetModules();
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.PRIVATE_DATA_ROOT;
});

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.isFile() && entry.name.endsWith('.ts') ? [absolute] : [];
  });
}

describe('private data root isolation', () => {
  it('writes representative runtime stores beneath PRIVATE_DATA_ROOT', async () => {
    const balanceStore = await import('../../server/lib/balanceStore.js');
    balanceStore.appendBalanceTx({
      userId: 'user-1',
      userName: 'Test User',
      userEmail: 'test@example.test',
      type: 'manual_credit',
      amount: 10,
      previousBalance: 0,
      newBalance: 10,
      note: 'Isolation test',
      adminId: 'admin-1',
      adminName: 'Test Admin',
      ip: '127.0.0.1',
    });

    const securityStore = await import('../../server/lib/securityStore.js');
    securityStore.createFlag({
      userId: 'user-1',
      userName: 'Test User',
      userEmail: 'test@example.test',
      type: 'manual',
      severity: 'low',
      status: 'active',
      title: 'Isolation test',
      detail: 'Storage location verification',
    });

    expect(fs.existsSync(path.join(root, 'balance', 'transactions.jsonl'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'security', 'flags.jsonl'))).toBe(true);
  });

  it('does not allow active runtime source to bypass the shared path helper', () => {
    const serverRoot = path.resolve(process.cwd(), 'src/server');
    const files = [
      ...sourceFiles(path.join(serverRoot, 'lib')),
      ...sourceFiles(path.join(serverRoot, 'api')),
    ];

    const offenders = files.filter(file => {
      if (file.endsWith(`${path.sep}storagePaths.ts`)) return false;
      const source = fs.readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      return /(['"])\/private(?:\/|\1)/.test(source);
    });

    expect(offenders).toEqual([]);
  });
});
