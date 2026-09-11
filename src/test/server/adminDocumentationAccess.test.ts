import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { allowedRolesForAdminRequest } from '../../server/lib/adminAuthorizationMiddleware.js';
import handler from '../../server/api/admin/documentation/[format]/GET.js';

function response() {
  const state: { status: number; body?: unknown; headers: Record<string, string> } = {
    status: 200,
    headers: {},
  };
  const res = {
    status(code: number) { state.status = code; return res; },
    json(body: unknown) { state.body = body; return res; },
    send(body: unknown) { state.body = body; return res; },
    setHeader(name: string, value: string) { state.headers[name.toLowerCase()] = value; return res; },
  } as unknown as Response;
  return { res, state };
}

describe('administrator API documentation access', () => {
  it('keeps reference files out of the public asset tree', () => {
    expect(fs.existsSync(path.resolve('public', 'docs', 'api-documentation.md'))).toBe(false);
    expect(fs.existsSync(path.resolve('docs', 'api-reference', 'api-documentation.md'))).toBe(true);
  });

  it('restricts documentation routes to security administrators and super administrators', () => {
    expect(allowedRolesForAdminRequest('/documentation/markdown', 'GET')).toEqual([]);
  });

  it.each([
    ['markdown', 'text/markdown'],
    ['csv', 'text/csv'],
    ['postman', 'application/json'],
    ['openapi', 'application/yaml'],
  ])('serves the protected %s reference with snapshot headers', (format, contentType) => {
    const result = response();
    handler({ params: { format }, query: {} } as unknown as Request, result.res);

    expect(result.state.status).toBe(200);
    expect(result.state.headers['content-type']).toContain(contentType);
    expect(result.state.headers['cache-control']).toBe('private, no-store');
    expect(result.state.headers['x-cgc-documentation-status']).toBe('reference-snapshot');
    expect(Buffer.isBuffer(result.state.body)).toBe(true);
    expect((result.state.body as Buffer).length).toBeGreaterThan(100);
  });

  it('rejects unknown formats without resolving arbitrary paths', () => {
    const result = response();
    handler({ params: { format: '../../package.json' }, query: {} } as unknown as Request, result.res);
    expect(result.state.status).toBe(404);
  });
});
