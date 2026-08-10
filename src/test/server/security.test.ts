/**
 * Security middleware unit tests — City Gate Capital
 *
 * Tests path hardening, CSP nonce generation, and request size guard.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Path hardening middleware ─────────────────────────────────────────────────

describe('pathHardeningMiddleware', () => {
  function makeReq(url: string): Partial<Request> {
    return { url, path: url.split('?')[0], method: 'GET' } as Partial<Request>;
  }

  function makeRes(): { status: Mock; json: Mock; statusCode: number } {
    const res = {
      statusCode: 200,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return res as unknown as { status: Mock; json: Mock; statusCode: number };
  }

  it('blocks path traversal attempts', async () => {
    const { pathHardeningMiddleware } = await import('../../server/lib/pathHardeningMiddleware.js');
    const req = makeReq('/api/../../../etc/passwd');
    const res = makeRes();
    const next = vi.fn();
    pathHardeningMiddleware(req as Request, res as unknown as Response, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks null byte injection', async () => {
    const { pathHardeningMiddleware } = await import('../../server/lib/pathHardeningMiddleware.js');
    const req = makeReq('/api/users\x00.json');
    const res = makeRes();
    const next = vi.fn();
    pathHardeningMiddleware(req as Request, res as unknown as Response, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows normal API paths', async () => {
    const { pathHardeningMiddleware } = await import('../../server/lib/pathHardeningMiddleware.js');
    const req = makeReq('/api/users/login');
    const res = makeRes();
    const next = vi.fn();
    pathHardeningMiddleware(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows normal page paths', async () => {
    const { pathHardeningMiddleware } = await import('../../server/lib/pathHardeningMiddleware.js');
    const req = makeReq('/about');
    const res = makeRes();
    const next = vi.fn();
    pathHardeningMiddleware(req as Request, res as unknown as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
  });
});

// ── Security headers ──────────────────────────────────────────────────────────

describe('securityHeaders', () => {
  it('sets X-Frame-Options to DENY', async () => {
    const { securityHeaders } = await import('../../server/lib/securityMiddleware.js');
    const headers: Record<string, string> = {};
    const req = { headers: {}, secure: false } as unknown as Request;
    const res = {
      setHeader: vi.fn((k: string, v: string) => { headers[k] = v; }),
      locals: {},
    } as unknown as Response;
    const next = vi.fn();
    securityHeaders(req, res, next);
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(next).toHaveBeenCalled();
  });

  it('sets X-Content-Type-Options to nosniff', async () => {
    const { securityHeaders } = await import('../../server/lib/securityMiddleware.js');
    const headers: Record<string, string> = {};
    const req = { headers: {}, secure: false } as unknown as Request;
    const res = {
      setHeader: vi.fn((k: string, v: string) => { headers[k] = v; }),
      locals: {},
    } as unknown as Response;
    const next = vi.fn();
    securityHeaders(req, res, next);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('sets CSP with frame-ancestors none', async () => {
    const { securityHeaders } = await import('../../server/lib/securityMiddleware.js');
    const headers: Record<string, string> = {};
    const req = { headers: {}, secure: false } as unknown as Request;
    const res = {
      setHeader: vi.fn((k: string, v: string) => { headers[k] = v; }),
      locals: {},
    } as unknown as Response;
    const next = vi.fn();
    securityHeaders(req, res, next);
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  });

  it('allows the configured Tawk live-support origins', async () => {
    const { securityHeaders } = await import('../../server/lib/securityMiddleware.js');
    const headers: Record<string, string> = {};
    const req = { headers: {}, secure: false } as unknown as Request;
    const res = {
      setHeader: vi.fn((k: string, v: string) => { headers[k] = v; }),
      locals: {},
    } as unknown as Response;
    const next = vi.fn();
    securityHeaders(req, res, next);
    const csp = headers['Content-Security-Policy'];
    expect(csp).toContain('https://embed.tawk.to');
    expect(csp).toContain('wss://*.tawk.to');
    expect(csp).toContain('frame-src https://*.tawk.to https://*.tawk.link');
    expect(csp).toContain('https://www.google.com https://maps.google.com');
  });

  it('sets HSTS on HTTPS requests', async () => {
    const { securityHeaders } = await import('../../server/lib/securityMiddleware.js');
    const headers: Record<string, string> = {};
    const req = {
      headers: { 'x-forwarded-proto': 'https' },
      secure: false,
    } as unknown as Request;
    const res = {
      setHeader: vi.fn((k: string, v: string) => { headers[k] = v; }),
      locals: {},
    } as unknown as Response;
    const next = vi.fn();
    securityHeaders(req, res, next);
    expect(headers['Strict-Transport-Security']).toContain('max-age=');
    expect(headers['Strict-Transport-Security']).toContain('includeSubDomains');
  });
});
