import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The audit store falls back to the flat file whenever the database is not
// configured; forcing that state keeps every test in this file on the
// filesystem-backed store in a private temp root.
vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => false,
  getDb: vi.fn(),
}));

describe('legacy audit shim contracts', () => {
  let root = '';
  let auditFile = '';

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-audit-shim-'));
    process.env.PRIVATE_DATA_ROOT = root;
    vi.resetModules();
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
    delete process.env.PRIVATE_DATA_ROOT;
  });

  beforeEach(() => {
    auditFile = path.join(root, 'admin', 'audit.jsonl');
    fs.rmSync(path.dirname(auditFile), { force: true, recursive: true });
  });

  async function lastEntry(): Promise<{ action: string; details?: Record<string, unknown> }> {
    const store = await import('../../server/lib/auditLog.flatfile.js');
    // appendAudit persists asynchronously (fire-and-forget with an error
    // handler); poll briefly until the record has been written.
    let entries: { id: string; action: string; details?: Record<string, unknown> }[] = [];
    await vi.waitFor(() => {
      entries = store.readAuditFile().entries;
      expect(entries.length).toBeGreaterThan(0);
    });
    return entries[entries.length - 1];
  }

  it('redacts secret-shaped metadata keys at the audit boundary', async () => {
    const { appendAudit } = await import('../../server/lib/auditLog.js');
    appendAudit({
      event: 'customer_login_failed',
      userId: 'user-1',
      email: 'customer@example.test',
      meta: { password: 'hunter2', apiToken: 'tok', attempts: 3, reason: 'bad password' },
    });
    const entry = await lastEntry();
    expect(entry.action).toBe('customer_login_failed');
    expect(entry.details).toMatchObject({
      password: '[redacted]',
      apiToken: '[redacted]',
      attempts: 3,
      reason: 'bad password',
      actorKind: 'customer',
      userId: 'user-1',
    });
  });

  it('records which identifier family supplied the actor', async () => {
    const { appendAudit } = await import('../../server/lib/auditLog.js');
    appendAudit({ event: 'admin_action', adminId: 'admin_1', email: 'a@x.test' });
    expect((await lastEntry()).details).toMatchObject({ actorKind: 'admin' });

    appendAudit({ event: 'customer_action', userId: 'user_1' });
    expect((await lastEntry()).details).toMatchObject({ actorKind: 'customer', userId: 'user_1' });

    appendAudit({ event: 'system_action' });
    expect((await lastEntry()).details).toMatchObject({ actorKind: 'system' });
  });

  it('redacts sensitive extra keys and the critical path alike', async () => {
    const { appendAudit, appendCriticalAudit } = await import('../../server/lib/auditLog.js');
    appendAudit({ event: 'e1', rest: 'value', authCookie: 'c' });
    expect((await lastEntry()).details).toMatchObject({ rest: 'value', authCookie: '[redacted]' });

    await appendCriticalAudit({ event: 'critical_action', adminId: 'admin_1', meta: { recoveryCodes: ['a', 'b'] } });
    expect((await lastEntry()).details).toMatchObject({ recoveryCodes: '[redacted]', actorKind: 'admin' });
  });
});

describe('flat-file audit store resilience', () => {
  let root = '';
  let auditFile = '';

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-audit-flat-'));
    process.env.PRIVATE_DATA_ROOT = root;
    vi.resetModules();
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
    delete process.env.PRIVATE_DATA_ROOT;
  });

  beforeEach(() => {
    auditFile = path.join(root, 'admin', 'audit.jsonl');
    fs.rmSync(auditFile, { force: true, recursive: true });
    fs.mkdirSync(path.dirname(auditFile), { recursive: true });
  });

  function writeAuditFile(lines: string[]) {
    fs.writeFileSync(auditFile, lines.join('\n') + '\n', 'utf8');
  }

  function entry(id: string, action: string, details?: Record<string, unknown>): string {
    return JSON.stringify({
      id, adminId: 'admin-1', adminEmail: 'a@example.test', action, ip: '192.0.2.7',
      ts: new Date(Date.parse('2026-01-01T00:00:0' + id.slice(-1) + 'Z')).toISOString(), ...details ? { details } : {},
    });
  }

  it('skips malformed lines and reports them instead of returning an empty history', async () => {
    writeAuditFile([
      entry('al_1', 'admin_login_success'),
      '{"id": "al_broken" "truncated json"',
      entry('al_2', 'admin_login_failed'),
      'not json at all',
    ]);
    const store = await import('../../server/lib/auditLog.flatfile.js');
    const result = store.readAuditFile();
    expect(result.entries.map(e => e.id)).toEqual(['al_1', 'al_2']);
    expect(result.malformedLines).toBe(2);
    expect(result.unreadable).toBe(false);
  });

  it('reports a wholly unreadable log file instead of reading it as empty', async () => {
    // A directory where the log file belongs makes readFileSync throw (EISDIR).
    fs.rmSync(auditFile, { force: true, recursive: true });
    fs.mkdirSync(auditFile);
    const store = await import('../../server/lib/auditLog.flatfile.js');
    const result = store.readAuditFile();
    expect(result.unreadable).toBe(true);
    expect(result.entries).toEqual([]);
  });

  it('rejects structurally wrong records instead of trusting parsed JSON', async () => {
    writeAuditFile([
      JSON.stringify({ unexpected: 'shape' }),
      entry('al_3', 'admin_login_success'),
    ]);
    const store = await import('../../server/lib/auditLog.flatfile.js');
    const result = store.readAuditFile();
    expect(result.entries.map(e => e.id)).toEqual(['al_3']);
    expect(result.malformedLines).toBe(1);
  });
});

describe('audit page fallback and endpoint contract', () => {
  let root = '';
  let auditFile = '';
  let originalDatabaseUrl: string | undefined;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-audit-page-'));
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

  beforeEach(() => {
    auditFile = path.join(root, 'admin', 'audit.jsonl');
    fs.rmSync(auditFile, { force: true, recursive: true });
    fs.mkdirSync(path.dirname(auditFile), { recursive: true });
  });

  function writeAuditFile(lines: string[]) {
    fs.writeFileSync(auditFile, lines.join('\n') + '\n', 'utf8');
  }

  function entry(id: string, action: string, details?: Record<string, unknown>): string {
    return JSON.stringify({
      id, adminId: 'admin-' + id, adminEmail: 'actor@example.test', action,
      ts: new Date(Date.parse('2026-01-0' + id.slice(-1) + 'T00:00:00Z')).toISOString(),
      ...details ? { details } : {},
    });
  }

  function response() {
    const state: { status: number; body?: any } = { status: 200 };
    const res = {
      status(code: number) { state.status = code; return res; },
      json(body: unknown) { state.body = body; return res; },
    } as unknown as Response;
    return { res, state };
  }

  it('pages newest-first with search and severity filters over the flat-file fallback', async () => {
    writeAuditFile([
      entry('3', 'admin_login_success'),
      entry('2', 'customer_export_failed'),
      entry('1', 'sponsor.evidence_rejected', { role: 'SUPER_ADMIN', severity: 'critical' }),
    ]);
    const { getAuditLogPage } = await import('../../server/lib/auditLog.js');

    const warn = await getAuditLogPage({ page: 1, limit: 10, severity: 'warn' });
    // Only the assessed-warn failed action: a declared-critical record is not warn.
    expect(warn.entries.map(e => e.action)).toEqual(['customer_export_failed']);
    expect(warn.total).toBe(1);

    const page2 = await getAuditLogPage({ page: 2, limit: 1 });
    expect(page2.entries.map(e => e.action)).toEqual(['customer_export_failed']);
    expect(page2.total).toBe(3);

    const searched = await getAuditLogPage({ page: 1, limit: 10, search: 'ACTOR@' });
    expect(searched.total).toBe(3);

    const none = await getAuditLogPage({ page: 1, limit: 10, search: 'nomatch' });
    expect(none.entries).toEqual([]);
    expect(none.total).toBe(0);
    expect(none.dataQuality).toBeUndefined();
  });

  it('discloses malformed flat-file lines through dataQuality', async () => {
    writeAuditFile([entry('2', 'admin_login_success'), '{"broken"']);
    const { getAuditLogPage } = await import('../../server/lib/auditLog.js');
    const result = await getAuditLogPage({ page: 1, limit: 10 });
    expect(result.total).toBe(1);
    expect(result.dataQuality).toEqual({ malformedLines: 1, unreadable: false });
  });

  it('rejects invalid pagination with 400 instead of producing empty slices', async () => {
    const handler = (await import('../../server/api/admin/audit/GET.js')).default;
    for (const query of [
      { page: 'abc' }, { page: '0' }, { page: '1.5' }, { page: '2abc' }, { page: '-1' },
      { limit: '0' }, { limit: '200' }, { limit: 'NaN' }, { page: ['1', '2'] },
    ]) {
      const { res, state } = response();
      await handler({ query } as unknown as Request, res);
      expect(state.status).toBe(400);
    }
  });

  it('normalizes store fields to viewer fields and marks assessed severities', async () => {
    writeAuditFile([
      entry('1', 'admin_login_success'),
      entry('2', 'admin_action_failed', { severity: 'critical', ua: 'Mozilla/5.0' }),
    ]);
    const handler = (await import('../../server/api/admin/audit/GET.js')).default;

    const { res, state } = response();
    await handler({ query: { page: '1', limit: '10' } } as unknown as Request, res);
    expect(state.status).toBe(200);
    expect(state.body).toMatchObject({ total: 2, page: 1, limit: 10, pages: 1 });

    const byAction = Object.fromEntries(state.body.data.map((d: { action: string } & Record<string, unknown>) => [d.action, d]));
    expect(byAction.admin_action_failed).toMatchObject({
      actor: 'actor@example.test',
      actorId: 'admin-2',
      severity: 'critical',
      severitySource: 'declared',
      result: 'failure',
      userAgent: 'Mozilla/5.0',
    });
    expect(byAction.admin_login_success).toMatchObject({
      severity: 'info',
      severitySource: 'assessed',
      result: 'success',
    });
  });
});