import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  value: null as Record<string, unknown> | null,
  failWrite: false,
}));

vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => true,
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: async () => database.value === null
          ? []
          : [{ key: 'trusted_devices', value: database.value }],
      }),
    }),
    insert: () => ({
      values: (row: { value: Record<string, unknown> }) => ({
        onConflictDoUpdate: async ({ set }: { set: { value: Record<string, unknown> } }) => {
          if (database.failWrite) throw new Error('persistence unavailable');
          database.value = structuredClone(set.value ?? row.value);
        },
      }),
    }),
  }),
}));

import {
  listTrustedDevices,
  registerTrustedDevice,
  revokeTrustedDevice,
  validateTrustedDevice,
} from '../../server/lib/trustedDeviceStore.js';

describe('trusted-device token persistence', () => {
  beforeEach(() => {
    database.value = null;
    database.failWrite = false;
  });

  it('persists only a digest and addresses devices with an independent opaque ID', async () => {
    const registration = await registerTrustedDevice(
      'admin_001',
      'admin@citygate.capital',
      '127.0.0.1',
      'Mozilla/5.0 (Windows NT 10.0) Chrome/126.0',
    );

    const serialized = JSON.stringify(database.value);
    const digestKey = `sha256:${crypto.createHash('sha256').update(registration.token).digest('hex')}`;
    expect(serialized).not.toContain(registration.token);
    expect(Object.keys(database.value ?? {})).toEqual([digestKey]);

    const devices = await listTrustedDevices('admin_001');
    expect(devices).toHaveLength(1);
    expect(devices[0].id).toMatch(/^dev_[a-f0-9]{24}$/);
    expect(devices[0]).not.toHaveProperty('token');
    expect(await validateTrustedDevice(registration.token, 'admin_001')).toMatchObject({
      id: devices[0].id,
      adminId: 'admin_001',
    });

    await expect(revokeTrustedDevice('admin_002', devices[0].id)).resolves.toBe(false);
    await expect(validateTrustedDevice(registration.token, 'admin_001')).resolves.not.toBeNull();
    await expect(revokeTrustedDevice('admin_001', devices[0].id)).resolves.toBe(true);
    await expect(validateTrustedDevice(registration.token, 'admin_001')).resolves.toBeNull();
  });

  it('propagates persistence failures instead of reporting a successful registration', async () => {
    database.failWrite = true;
    await expect(registerTrustedDevice(
      'admin_001',
      'admin@citygate.capital',
      '127.0.0.1',
      'Mozilla/5.0',
    )).rejects.toThrow('persistence unavailable');
  });
});
