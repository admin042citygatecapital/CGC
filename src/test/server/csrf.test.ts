import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { csrfProtect } from '../../server/api/csrf/GET.js';

function responseMock() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { response: { status } as unknown as Response, status };
}

describe('admin CSRF protection', () => {
  it('allows safe methods without a token', () => {
    const next = vi.fn();
    const { response } = responseMock();
    csrfProtect({ method: 'GET' } as Request, response, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects a write without matching header and cookie tokens', () => {
    const next = vi.fn();
    const { response, status } = responseMock();
    csrfProtect({ method: 'POST', headers: {}, cookies: {} } as Request, response, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it('accepts a write with matching header and HttpOnly cookie tokens', () => {
    const next = vi.fn();
    const { response, status } = responseMock();
    const token = 'a'.repeat(64);
    csrfProtect({
      method: 'POST',
      headers: { 'x-csrf-token': token },
      cookies: { csrf_token: token },
    } as unknown as Request, response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });
});
