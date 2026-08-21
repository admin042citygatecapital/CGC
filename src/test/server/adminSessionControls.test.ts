import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionStore = vi.hoisted(() => ({
  listSessions: vi.fn(),
  deleteSession: vi.fn(),
  deleteAllSessionsForAdmin: vi.fn(),
}));
const audit = vi.hoisted(() => ({ appendAudit: vi.fn() }));

vi.mock('../../server/lib/sessionStore.js', () => sessionStore);
vi.mock('../../server/lib/auditLog.js', () => audit);

import listSessions from '../../server/api/admin/security/sessions/GET.js';
import deleteSession from '../../server/api/admin/security/sessions/DELETE.js';

function responseDouble() {
  const result = { status: 200, body: undefined as unknown };
  const res = {
    status(code: number) { result.status = code; return res; },
    json(body: unknown) { result.body = body; return res; },
  } as unknown as Response;
  return { res, result };
}

const rawToken = 'a'.repeat(64);
const session = {
  token: rawToken,
  adminId: 'admin_001',
  email: 'admin@citygate.capital',
  role: 'SUPER_ADMIN',
  createdAt: '2026-08-20T00:00:00.000Z',
  ip: '127.0.0.1',
  ua: 'Test Browser',
};

beforeEach(() => {
  sessionStore.listSessions.mockReset();
  sessionStore.deleteSession.mockReset();
  sessionStore.deleteAllSessionsForAdmin.mockReset();
  audit.appendAudit.mockReset();
});

describe('administrator session controls', () => {
  it('returns an irreversible session reference instead of a session token', async () => {
    sessionStore.listSessions.mockResolvedValue([session]);
    const response = responseDouble();
    await listSessions({} as Request, response.res);

    const expectedReference = crypto.createHash('sha256').update(rawToken).digest('hex');
    expect(response.result.body).toMatchObject({ sessions: [{ token: expectedReference }] });
    expect(JSON.stringify(response.result.body)).not.toContain(rawToken);
  });

  it('revokes by the safe reference and does not put token material in the audit event', async () => {
    sessionStore.listSessions.mockResolvedValue([session]);
    const reference = crypto.createHash('sha256').update(rawToken).digest('hex');
    const response = responseDouble();
    await deleteSession({ body: { token: reference }, ip: '127.0.0.1', headers: {} } as Request, response.res);

    expect(sessionStore.deleteSession).toHaveBeenCalledWith(rawToken);
    expect(audit.appendAudit).toHaveBeenCalledWith({ event: 'admin_session_terminated', ip: '127.0.0.1' });
    expect(JSON.stringify(audit.appendAudit.mock.calls)).not.toContain(rawToken.slice(0, 8));
    expect(response.result.body).toEqual({ ok: true, message: 'Session terminated' });
  });
});
