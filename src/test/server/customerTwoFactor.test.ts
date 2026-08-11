import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyTotp } from '../../server/lib/totp.js';

const stores = vi.hoisted(() => ({
  updateUser: vi.fn(),
  appendAudit: vi.fn(),
}));

vi.mock('../../server/lib/userStore.js', () => ({ updateUser: stores.updateUser }));
vi.mock('../../server/lib/auditLog.js', () => ({ appendAudit: stores.appendAudit }));

import setupTwoFactor from '../../server/api/users/2fa/setup/POST.js';
import verifyTwoFactor from '../../server/api/users/2fa/verify/POST.js';

function responseDouble() {
  const result = { status: 200, body: undefined as unknown };
  const res = {
    status(code: number) { result.status = code; return res; },
    json(body: unknown) { result.body = body; return res; },
  } as unknown as Response;
  return { res, result };
}

beforeEach(() => {
  stores.updateUser.mockReset().mockResolvedValue(undefined);
  stores.appendAudit.mockReset();
});

describe('customer TOTP controls', () => {
  it('validates a known RFC 6238 SHA-1 code and rejects an incorrect code', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    expect(verifyTotp(secret, '287082', 59_000)).toBe(true);
    expect(verifyTotp(secret, '000000', 59_000)).toBe(false);
  });

  it('persists a pending secret for the authenticated customer', async () => {
    const req = { customerUser: { id: 'user-1', email: 'customer@example.com' }, ip: '127.0.0.1' } as unknown as Request;
    const response = responseDouble();
    await setupTwoFactor(req, response.res);
    expect(response.result.status).toBe(200);
    expect(response.result.body).toMatchObject({ secret: expect.stringMatching(/^[A-Z2-7]+$/), qrUrl: expect.stringContaining('otpauth://totp/') });
    expect(stores.updateUser).toHaveBeenCalledWith('user-1', expect.objectContaining({ totpEnabled: false }));
  });

  it('does not enable 2FA for an invalid code', async () => {
    const req = {
      customerUser: { id: 'user-1', email: 'customer@example.com', totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' },
      body: { code: '000000' }, ip: '127.0.0.1',
    } as unknown as Request;
    const response = responseDouble();
    await verifyTwoFactor(req, response.res);
    expect(response.result.status).toBe(401);
    expect(stores.updateUser).not.toHaveBeenCalled();
    expect(stores.appendAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'customer_2fa_verification_failed' }));
  });
});
