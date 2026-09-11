import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumeRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  totpCodeAt,
  verifyTotp,
} from '../../server/lib/totp.js';

const stores = vi.hoisted(() => ({
  updateUser: vi.fn(),
  appendAudit: vi.fn(),
  verifyPassword: vi.fn(),
  isRateLimited: vi.fn(),
}));

vi.mock('../../server/lib/userStore.js', () => ({ updateUser: stores.updateUser }));
vi.mock('../../server/lib/auditLog.js', () => ({ appendAudit: stores.appendAudit }));
vi.mock('../../server/lib/passwordHash.js', () => ({ verifyPassword: stores.verifyPassword }));
vi.mock('../../server/lib/rateLimiter.js', () => ({ isRateLimited: stores.isRateLimited }));

import setupTwoFactor from '../../server/api/users/2fa/setup/POST.js';
import verifyTwoFactor from '../../server/api/users/2fa/verify/POST.js';
import disableTwoFactor from '../../server/api/users/2fa/disable/POST.js';

const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

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
  stores.verifyPassword.mockReset();
  stores.isRateLimited.mockReset().mockReturnValue(false);
});

function codeNow(): string {
  return totpCodeAt(SECRET);
}

describe('customer TOTP controls', () => {
  it('validates a known RFC 6238 SHA-1 code and rejects an incorrect code', () => {
    expect(verifyTotp(SECRET, '287082', 59_000)).toBe(true);
    expect(verifyTotp(SECRET, '000000', 59_000)).toBe(false);
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
      customerUser: { id: 'user-1', email: 'customer@example.com', totpSecret: SECRET },
      body: { code: '000000' }, ip: '127.0.0.1',
    } as unknown as Request;
    const response = responseDouble();
    await verifyTwoFactor(req, response.res);
    expect(response.result.status).toBe(401);
    expect(stores.updateUser).not.toHaveBeenCalled();
    expect(stores.appendAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'customer_2fa_verification_failed' }));
  });

  it('enables 2FA with a valid code and issues single-use recovery codes as hashes', async () => {
    const req = {
      customerUser: { id: 'user-1', email: 'customer@example.com', totpSecret: SECRET },
      body: { code: codeNow() }, ip: '127.0.0.1',
    } as unknown as Request;
    const response = responseDouble();
    await verifyTwoFactor(req, response.res);
    expect(response.result.status).toBe(200);
    expect(response.result.body).toMatchObject({ ok: true, recoveryCodes: expect.any(Array) });
    const body = response.result.body as { recoveryCodes: string[] };
    expect(body.recoveryCodes).toHaveLength(10);
    expect(body.recoveryCodes.every(c => /^[0-9a-f]{5}-[0-9a-f]{5}$/.test(c))).toBe(true);
    expect(stores.updateUser).toHaveBeenCalledWith('user-1', expect.objectContaining({
      totpEnabled: true,
      totpRecoveryHashes: body.recoveryCodes.map(hashRecoveryCode),
    }));
    expect(stores.appendAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'customer_2fa_enabled' }));
  });

  it('refuses to disable 2FA without password and second factor', async () => {
    const req = {
      customerUser: { id: 'user-1', email: 'customer@example.com', totpEnabled: true, totpSecret: SECRET, totpRecoveryHashes: [] },
      body: {}, ip: '127.0.0.1',
    } as unknown as Request;
    const response = responseDouble();
    await disableTwoFactor(req, response.res);
    expect(response.result.status).toBe(400);
    expect(stores.updateUser).not.toHaveBeenCalled();
  });

  it('denies disabling 2FA with the wrong password', async () => {
    stores.verifyPassword.mockResolvedValue({ ok: false });
    const req = {
      customerUser: { id: 'user-1', email: 'customer@example.com', totpEnabled: true, totpSecret: SECRET, passwordHash: 'hash' },
      body: { currentPassword: 'nope', code: codeNow() }, ip: '127.0.0.1',
    } as unknown as Request;
    const response = responseDouble();
    await disableTwoFactor(req, response.res);
    expect(response.result.status).toBe(401);
    expect(response.result.body).toMatchObject({ error: 'Current password is incorrect' });
    expect(stores.updateUser).not.toHaveBeenCalled();
    expect(stores.appendAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'customer_2fa_disable_denied' }));
  });

  it('denies disabling 2FA when the second factor does not match', async () => {
    stores.verifyPassword.mockResolvedValue({ ok: true });
    const req = {
      customerUser: { id: 'user-1', email: 'customer@example.com', totpEnabled: true, totpSecret: SECRET, passwordHash: 'hash', totpRecoveryHashes: [] },
      body: { currentPassword: 'pw', code: '000000' }, ip: '127.0.0.1',
    } as unknown as Request;
    const response = responseDouble();
    await disableTwoFactor(req, response.res);
    expect(response.result.status).toBe(401);
    expect(stores.updateUser).not.toHaveBeenCalled();
    expect(stores.appendAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'customer_2fa_disable_failed' }));
  });

  it('disables 2FA with password + valid authenticator code and clears all 2FA state', async () => {
    stores.verifyPassword.mockResolvedValue({ ok: true });
    const req = {
      customerUser: { id: 'user-1', email: 'customer@example.com', totpEnabled: true, totpSecret: SECRET, passwordHash: 'hash', totpRecoveryHashes: [] },
      body: { currentPassword: 'pw', code: codeNow() }, ip: '127.0.0.1',
    } as unknown as Request;
    const response = responseDouble();
    await disableTwoFactor(req, response.res);
    expect(response.result.status).toBe(200);
    expect(stores.updateUser).toHaveBeenCalledWith('user-1', {
      totpEnabled: false,
      totpSecret: null,
      totpRecoveryHashes: null,
    });
    expect(stores.appendAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'customer_2fa_disabled', meta: { secondFactor: 'totp' } }));
  });

  it('disables 2FA with password + unused recovery code', async () => {
    stores.verifyPassword.mockResolvedValue({ ok: true });
    const codes = generateRecoveryCodes();
    const hashes = codes.map(hashRecoveryCode);
    const req = {
      customerUser: { id: 'user-1', email: 'customer@example.com', totpEnabled: true, totpSecret: SECRET, passwordHash: 'hash', totpRecoveryHashes: hashes },
      body: { currentPassword: 'pw', code: codes[0] }, ip: '127.0.0.1',
    } as unknown as Request;
    const response = responseDouble();
    await disableTwoFactor(req, response.res);
    expect(response.result.status).toBe(200);
    expect(stores.updateUser).toHaveBeenCalledWith('user-1', {
      totpEnabled: false,
      totpSecret: null,
      totpRecoveryHashes: null,
    });
    expect(stores.appendAudit).toHaveBeenCalledWith(expect.objectContaining({ event: 'customer_2fa_disabled', meta: { secondFactor: 'recovery_code' } }));
  });

  it('consumes a recovery code exactly once', () => {
    const codes = generateRecoveryCodes();
    const hashes = codes.map(hashRecoveryCode);
    const remaining = consumeRecoveryCode(hashes, codes[0]);
    if (!remaining) throw new Error('first consumption must leave the remaining hashes');
    expect(remaining).toEqual(hashes.filter((_, i) => i !== 0));
    // The updated list is what gets persisted — the consumed code must be gone.
    expect(consumeRecoveryCode(remaining, codes[0])).toBeNull();
    expect(consumeRecoveryCode(remaining, 'zzzz')).toBeNull();
  });
});
