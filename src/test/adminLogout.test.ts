import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFetch, refreshAdminCsrfToken, revokeAdminSession } from '../lib/adminAuth.js';

function response(status: number, body: Record<string, unknown> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('administrator browser logout', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, { csrfToken: 'initial-token' })));
    await refreshAdminCsrfToken();
  });

  it('retries with a refreshed CSRF token before confirming revocation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(403, { error: 'CSRF token invalid or expired' }))
      .mockResolvedValueOnce(response(200, { csrfToken: 'refreshed-token' }))
      .mockResolvedValueOnce(response(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(revokeAdminSession()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'POST' });
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('X-CSRF-Token')).toBe('refreshed-token');
  });

  it('retries a state-changing request once with the refreshed token', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(403, { error: 'CSRF token invalid or expired' }))
      .mockResolvedValueOnce(response(200, { csrfToken: 'fresh-token' }))
      .mockResolvedValueOnce(response(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await adminFetch('/api/admin/kyc/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'request-1' },
      body: JSON.stringify({ userId: 'synthetic-user' }),
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retry = fetchMock.mock.calls[2]?.[1];
    const retryHeaders = new Headers(retry?.headers);
    expect(retryHeaders.get('X-CSRF-Token')).toBe('fresh-token');
    expect(retryHeaders.get('Content-Type')).toBe('application/json');
    expect(retryHeaders.get('X-Request-ID')).toBe('request-1');
    expect(retry).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      body: JSON.stringify({ userId: 'synthetic-user' }),
    });
  });

  it('does not retry an ordinary permission denial', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(403, { error: 'Insufficient permissions' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await adminFetch('/api/admin/security/roles', { method: 'POST' });

    expect(result.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never loops when the retried request is also rejected', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(403, { error: 'CSRF token invalid or expired' }))
      .mockResolvedValueOnce(response(200, { csrfToken: 'fresh-token' }))
      .mockResolvedValueOnce(response(403, { error: 'CSRF token invalid or expired' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await adminFetch('/api/admin/kyc/approve', { method: 'POST' });

    expect(result.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not report a secure logout when revocation fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
    await expect(revokeAdminSession()).resolves.toBe(false);
  });
});
