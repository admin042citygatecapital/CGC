import { beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshAdminCsrfToken, revokeAdminSession } from '../lib/adminAuth.js';

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
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'X-CSRF-Token': 'refreshed-token' },
    });
  });

  it('does not report a secure logout when revocation fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
    await expect(revokeAdminSession()).resolves.toBe(false);
  });
});
