import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  listTrustedDevices: vi.fn(),
  revokeTrustedDevice: vi.fn(),
  revokeAllTrustedDevices: vi.fn(),
}));
const audit = vi.hoisted(() => ({ appendAudit: vi.fn() }));

vi.mock('../../server/lib/trustedDeviceStore.js', () => store);
vi.mock('../../server/lib/auditLog.js', () => audit);

import canonicalDelete from '../../server/api/admin/auth/trusted-devices/DELETE.js';
import canonicalGet from '../../server/api/admin/auth/trusted-devices/GET.js';
import compatibilityDelete from '../../server/api/admin/security/devices/DELETE.js';
import compatibilityGet from '../../server/api/admin/security/devices/GET.js';

function responseDouble() {
  const result = { status: 200, body: undefined as unknown };
  const res = {
    status(code: number) { result.status = code; return res; },
    json(body: unknown) { result.body = body; return res; },
  } as unknown as Response;
  return { res, result };
}

const device = {
  id: 'dev_0123456789abcdef01234567',
  adminId: 'admin_001',
  email: 'admin@citygate.capital',
  name: 'Chrome on Windows',
  ip: '127.0.0.1',
  ua: 'Mozilla/5.0',
  createdAt: '2026-08-20T00:00:00.000Z',
  expiresAt: '2026-09-20T00:00:00.000Z',
  lastUsedAt: '2026-08-21T00:00:00.000Z',
};

beforeEach(() => {
  store.listTrustedDevices.mockReset();
  store.revokeTrustedDevice.mockReset();
  store.revokeAllTrustedDevices.mockReset();
  audit.appendAudit.mockReset();
});

describe('administrator trusted-device controls', () => {
  it('delegates the compatibility routes to the canonical handlers', () => {
    expect(compatibilityGet).toBe(canonicalGet);
    expect(compatibilityDelete).toBe(canonicalDelete);
  });

  it('uses the authenticated administrator and never returns a token reference', async () => {
    store.listTrustedDevices.mockResolvedValue([device]);
    const response = responseDouble();
    await canonicalGet({ adminSession: { adminId: 'admin_001' } } as Request, response.res);

    expect(store.listTrustedDevices).toHaveBeenCalledWith('admin_001');
    expect(response.result.body).toMatchObject({ devices: [{ id: device.id }], total: 1 });
    expect(JSON.stringify(response.result.body)).not.toContain('token');
  });

  it('revokes only an owned device addressed by opaque device ID', async () => {
    store.listTrustedDevices.mockResolvedValue([device]);
    store.revokeTrustedDevice.mockResolvedValue(true);
    const response = responseDouble();
    await canonicalDelete({
      adminSession: { adminId: 'admin_001', email: 'admin@citygate.capital' },
      body: { deviceId: device.id },
      ip: '127.0.0.1',
    } as Request, response.res);

    expect(store.revokeTrustedDevice).toHaveBeenCalledWith('admin_001', device.id);
    expect(response.result.body).toEqual({ ok: true, message: 'Device "Chrome on Windows" revoked' });
    expect(JSON.stringify(store.revokeTrustedDevice.mock.calls)).not.toContain('sha256:');
  });

  it('does not accept a foreign or token-like device reference', async () => {
    store.listTrustedDevices.mockResolvedValue([]);
    const response = responseDouble();
    await canonicalDelete({
      adminSession: { adminId: 'admin_002', email: 'other@citygate.capital' },
      body: { deviceId: 'sha256:' + 'a'.repeat(64) },
      ip: '127.0.0.1',
    } as Request, response.res);

    expect(response.result.status).toBe(404);
    expect(store.revokeTrustedDevice).not.toHaveBeenCalled();
  });

  it('propagates persistence failures', async () => {
    store.listTrustedDevices.mockRejectedValue(new Error('persistence unavailable'));
    const response = responseDouble();
    await expect(canonicalGet(
      { adminSession: { adminId: 'admin_001' } } as Request,
      response.res,
    )).rejects.toThrow('persistence unavailable');
  });
});
