import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionStore = vi.hoisted(() => ({
  listSessions: vi.fn(),
  deleteSessionByHash: vi.fn(),
  deleteAllSessionsForAdmin: vi.fn(),
}));
const audit = vi.hoisted(() => ({ appendAudit: vi.fn() }));

vi.mock('../../server/lib/sessionStore.js', () => sessionStore);
vi.mock('../../server/lib/auditLog.js', () => audit);

import listSessions from '../../server/api/admin/security/sessions/GET.js';
import deleteSession from '../../server/api/admin/security/sessions/DELETE.js';
import patchSession from '../../server/api/admin/security/sessions/PATCH.js';

function responseDouble() {
  const result = { status: 200, body: undefined as unknown };
  const res = {
    status(code: number) { result.status = code; return res; },
    json(body: unknown) { result.body = body; return res; },
  } as unknown as Response;
  return { res, result };
}

const rawToken = 'a'.repeat(64);
const storedDigest = crypto.createHash('sha256').update(rawToken).digest('hex');
const session = {
  token: storedDigest,
  adminId: 'admin_001',
  email: 'admin@citygate.capital',
  role: 'SUPER_ADMIN',
  createdAt: new Date().toISOString(),
  ip: '127.0.0.1',
  ua: 'Test Browser',
};

beforeEach(() => {
  sessionStore.listSessions.mockReset();
  sessionStore.deleteSessionByHash.mockReset();
  sessionStore.deleteAllSessionsForAdmin.mockReset();
  audit.appendAudit.mockReset();
});

describe('administrator session controls', () => {
  it('returns an irreversible session reference instead of a session token', async () => {
    sessionStore.listSessions.mockResolvedValue([session]);
    const response = responseDouble();
    await listSessions({} as Request, response.res);

    expect(response.result.body).toMatchObject({ sessions: [{ token: storedDigest }] });
    expect(JSON.stringify(response.result.body)).not.toContain(rawToken);
  });

  it('revokes by the safe reference and does not put token material in the audit event', async () => {
    sessionStore.listSessions.mockResolvedValue([session]);
    const response = responseDouble();
    await deleteSession({
      body: { token: storedDigest, reason: 'Security investigation', confirmation: 'CONFIRM SESSION REVOCATION' },
      ip: '127.0.0.1', headers: {}, adminSession: session,
    } as unknown as Request, response.res);

    expect(sessionStore.deleteSessionByHash).toHaveBeenCalledWith(storedDigest);
    expect(audit.appendAudit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'admin_session_terminated', ip: '127.0.0.1', adminId: 'admin_001', reason: 'Security investigation',
    }));
    expect(JSON.stringify(audit.appendAudit.mock.calls)).not.toContain(rawToken.slice(0, 8));
    expect(response.result.body).toEqual({ ok: true, message: 'Session terminated' });
  });

  it('fails closed instead of claiming an existing privileged session was extended', async () => {
    const response = responseDouble();
    await patchSession({ body: { action: 'extend', token: storedDigest } } as Request, response.res);

    expect(response.result.status).toBe(501);
    expect(response.result.body).toEqual({
      error: 'Session extension is not supported. Sign in again to start a new session.',
    });
    expect(audit.appendAudit).not.toHaveBeenCalled();
  });
});
