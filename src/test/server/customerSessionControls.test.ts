import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionStore = vi.hoisted(() => ({
  listCustomerSessions: vi.fn(),
  revokeCustomerSession: vi.fn(),
}));

vi.mock('../../server/lib/customerSessionStore.js', () => sessionStore);

import listSessions from '../../server/api/users/security/sessions/GET.js';
import revokeSession from '../../server/api/users/security/sessions/revoke/POST.js';

function responseDouble() {
  const result = { status: 200, body: undefined as unknown, cleared: false };
  const res = {
    status(code: number) { result.status = code; return res; },
    json(body: unknown) { result.body = body; return res; },
    clearCookie() { result.cleared = true; return res; },
  } as unknown as Response;
  return { res, result };
}

beforeEach(() => {
  sessionStore.listCustomerSessions.mockReset();
  sessionStore.revokeCustomerSession.mockReset();
});

describe('customer session controls', () => {
  it('lists safe session metadata without returning a credential', async () => {
    sessionStore.listCustomerSessions.mockResolvedValue([{
      id: '1'.repeat(24), ip: '127.0.0.1', ua: 'Test Browser',
      createdAt: '2026-01-01T00:00:00.000Z', lastSeenAt: '2026-01-01T00:01:00.000Z',
      expiresAt: '2026-01-01T08:00:00.000Z', isCurrent: true,
    }]);
    const token = 'a'.repeat(64);
    const req = { customerUser: { id: 'user-1' }, customerToken: token } as unknown as Request;
    const response = responseDouble();

    await listSessions(req, response.res);

    expect(sessionStore.listCustomerSessions).toHaveBeenCalledWith('user-1', token);
    expect(response.result.body).toMatchObject({ sessions: [{ id: '1'.repeat(24), current: true }] });
    expect(JSON.stringify(response.result.body)).not.toContain(token);
  });

  it('scopes revocation to the authenticated user and clears a current cookie', async () => {
    const token = 'b'.repeat(64);
    const sessionId = crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
    sessionStore.revokeCustomerSession.mockResolvedValue(true);
    const req = {
      customerUser: { id: 'user-1' }, customerToken: token, body: { sessionId },
    } as unknown as Request;
    const response = responseDouble();

    await revokeSession(req, response.res);

    expect(sessionStore.revokeCustomerSession).toHaveBeenCalledWith('user-1', sessionId);
    expect(response.result.cleared).toBe(true);
    expect(response.result.body).toEqual({ ok: true, currentSessionRevoked: true });
  });

  it('does not claim success for an unknown or foreign session ID', async () => {
    sessionStore.revokeCustomerSession.mockResolvedValue(false);
    const req = {
      customerUser: { id: 'user-1' }, customerToken: 'c'.repeat(64), body: { sessionId: '2'.repeat(24) },
    } as unknown as Request;
    const response = responseDouble();

    await revokeSession(req, response.res);

    expect(response.result.status).toBe(404);
    expect(response.result.body).toEqual({ error: 'Session not found' });
  });
});
