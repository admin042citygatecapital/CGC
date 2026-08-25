import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock('../../server/lib/sessionStore.js', () => ({ getSession }));

import {
  COOKIE_NAME,
  requireAdminAuth,
  sessionCookieOptions,
} from '../../server/lib/adminAuthMiddleware.js';

const VALID_TOKEN = 'a'.repeat(64);

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
  getSession.mockReset();
});

describe('administrator cookie authentication boundary', () => {
  it('accepts the dedicated HttpOnly cookie and attaches the session', async () => {
    const session = { adminId: 'admin-1', email: 'admin@example.test', role: 'SUPER_ADMIN' };
    getSession.mockResolvedValue(session);
    const req = {
      cookies: { [COOKIE_NAME]: VALID_TOKEN },
      headers: { 'user-agent': 'Test Browser' },
      ip: '127.0.0.1',
    } as unknown as Request;
    const { res } = responseDouble();
    const next = vi.fn() as unknown as NextFunction;

    await requireAdminAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(getSession).toHaveBeenCalledWith(VALID_TOKEN, { ip: '127.0.0.1', ua: 'Test Browser' });
    expect(req.adminSession).toBe(session);
    expect(req.adminToken).toBe(VALID_TOKEN);
  });

  it('rejects a browser-supplied bearer token', async () => {
    const req = {
      cookies: {},
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
    } as unknown as Request;
    const response = responseDouble();

    await requireAdminAuth(req, response.res, vi.fn());

    expect(response.result.status).toBe(401);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('uses an HttpOnly, Strict, API-scoped, secure production cookie', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(sessionCookieOptions(60_000)).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/api',
        maxAge: 60_000,
      });
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
