import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUserBySessionToken } = vi.hoisted(() => ({
  findUserBySessionToken: vi.fn(),
}));

vi.mock('../../server/lib/userStore.js', () => ({
  findUserBySessionToken,
}));

import {
  requireCustomerAuth,
  requireCustomerSameOrigin,
  resolveCustomerSessionToken,
} from '../../server/lib/customerAuthMiddleware.js';
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_COOKIE_PATH,
  customerSessionCookieOptions,
} from '../../server/lib/customerSessionConfig.js';

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
  findUserBySessionToken.mockReset();
});

describe('customer cookie authentication boundary', () => {
  it('accepts only the dedicated HttpOnly cookie as a browser credential', async () => {
    const user = { id: 'user-1', email: 'customer@example.test' };
    findUserBySessionToken.mockResolvedValue(user);
    const req = {
      cookies: { [CUSTOMER_SESSION_COOKIE]: VALID_TOKEN },
      headers: {},
    } as unknown as Request;
    const { res } = responseDouble();
    const next = vi.fn() as unknown as NextFunction;

    await requireCustomerAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.customerUser).toBe(user);
    expect(req.customerToken).toBe(VALID_TOKEN);
    expect(req.headers.authorization).toBe(`Bearer ${VALID_TOKEN}`);
  });

  it('does not accept a browser-supplied bearer token and clears stale cookies', async () => {
    const bearerReq = {
      cookies: {},
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
    } as unknown as Request;
    const bearerResponse = responseDouble();
    await requireCustomerAuth(bearerReq, bearerResponse.res, vi.fn());
    expect(bearerResponse.result.status).toBe(401);

    findUserBySessionToken.mockResolvedValue(undefined);
    const staleReq = { cookies: { [CUSTOMER_SESSION_COOKIE]: VALID_TOKEN }, headers: {} } as unknown as Request;
    const staleResponse = responseDouble();
    await requireCustomerAuth(staleReq, staleResponse.res, vi.fn());
    expect(staleResponse.result.status).toBe(401);
    expect(staleResponse.result.cleared).toBe(true);
  });

  it('requires the exact configured origin for every customer mutation', () => {
    const originalPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = 'https://citygate.capital';
    try {
      const accepted = responseDouble();
      const acceptedNext = vi.fn();
      const acceptedHeaders = { origin: 'https://citygate.capital', 'sec-fetch-site': 'same-origin' };
      requireCustomerSameOrigin({
        method: 'POST',
        headers: acceptedHeaders,
        get(name: string) { return acceptedHeaders[name.toLowerCase() as keyof typeof acceptedHeaders]; },
      } as unknown as Request, accepted.res, acceptedNext);
      expect(acceptedNext).toHaveBeenCalledOnce();

      for (const origin of [undefined, 'https://attacker.example', 'https://admin.citygate.capital']) {
        const rejected = responseDouble();
        const rejectedHeaders: Record<string, string> = origin ? { origin } : {};
        requireCustomerSameOrigin({
          method: 'POST',
          headers: rejectedHeaders,
          get(name: string) { return rejectedHeaders[name.toLowerCase()]; },
        } as unknown as Request, rejected.res, vi.fn());
        expect(rejected.result.status).toBe(403);
        expect(rejected.result.body).toMatchObject({ code: 'CUSTOMER_CSRF_REJECTED' });
      }
    } finally {
      if (originalPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = originalPublicUrl;
    }
  });

  it('accepts the owned production domain when APP_URL still names the hosting service', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalPublicUrl = process.env.PUBLIC_URL;
    const originalAppUrl = process.env.APP_URL;
    process.env.NODE_ENV = 'production';
    delete process.env.PUBLIC_URL;
    process.env.APP_URL = 'https://city-gate-capital-preview-2026.onrender.com';
    try {
      const accepted = responseDouble();
      const acceptedNext = vi.fn();
      const headers = { origin: 'https://citygate.capital', 'sec-fetch-site': 'same-origin' };
      requireCustomerSameOrigin({
        method: 'POST',
        headers,
        get(name: string) { return headers[name.toLowerCase() as keyof typeof headers]; },
      } as unknown as Request, accepted.res, acceptedNext);
      expect(acceptedNext).toHaveBeenCalledOnce();

      const rejected = responseDouble();
      const hostileHeaders = { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' };
      requireCustomerSameOrigin({
        method: 'POST',
        headers: hostileHeaders,
        get(name: string) { return hostileHeaders[name.toLowerCase() as keyof typeof hostileHeaders]; },
      } as unknown as Request, rejected.res, vi.fn());
      expect(rejected.result.status).toBe(403);
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = originalPublicUrl;
      if (originalAppUrl === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = originalAppUrl;
    }
  });

  it('uses an HttpOnly, Strict, API-scoped session cookie', () => {
    const options = customerSessionCookieOptions();
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: 'strict',
      path: CUSTOMER_SESSION_COOKIE_PATH,
    });
    expect(options.maxAge).toBeGreaterThan(0);
    expect(resolveCustomerSessionToken({ cookies: {} } as Request)).toBeNull();

    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(customerSessionCookieOptions().secure).toBe(true);
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
