import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ configured: true, value: undefined as unknown, select: vi.fn(), insert: vi.fn() }));
vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => db.configured,
  getDb: () => ({ select: db.select, insert: db.insert }),
}));

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.unstubAllEnvs();
  db.configured = true; db.value = undefined;
  db.select.mockImplementation(() => ({ from: () => ({ where: async () => db.value === undefined ? [] : [{ value: db.value }] }) }));
});

describe('authoritative workflow state', () => {
  it('reads enabled switches on a cold instance without startup cache loading', async () => {
    db.value = { kycApprovalsEnabled: true, sandboxFinancialControlsEnabled: true };
    const store = await import('../../server/lib/configStore.js');
    expect(store.getConfig().featureToggles.kycApprovalsEnabled).toBe(false);
    expect(await store.readWorkflowControls()).toEqual(db.value);
  });

  it('observes a different instance disabling the switches on the next read', async () => {
    const store = await import('../../server/lib/configStore.js');
    db.value = { kycApprovalsEnabled: true, sandboxFinancialControlsEnabled: true };
    expect((await store.readWorkflowControls()).sandboxFinancialControlsEnabled).toBe(true);
    db.value = { kycApprovalsEnabled: false, sandboxFinancialControlsEnabled: false };
    expect(await store.readWorkflowControls()).toEqual(db.value);
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, null, { kycApprovalsEnabled: 'true', sandboxFinancialControlsEnabled: 1 }])('fails closed for missing or malformed state %j', async value => {
    db.value = value;
    const store = await import('../../server/lib/configStore.js');
    expect(await store.readWorkflowControls()).toEqual({ kycApprovalsEnabled: false, sandboxFinancialControlsEnabled: false });
  });

  it('does not retain enabled values after a database read failure', async () => {
    const store = await import('../../server/lib/configStore.js');
    db.value = { kycApprovalsEnabled: true, sandboxFinancialControlsEnabled: true };
    await store.readWorkflowControls();
    db.select.mockImplementation(() => { throw new Error('Database unavailable'); });
    expect(await store.readWorkflowControls()).toEqual({ kycApprovalsEnabled: false, sandboxFinancialControlsEnabled: false });
  });

  it('does not use development cache as a production fallback', async () => {
    db.configured = false; vi.stubEnv('NODE_ENV', 'development');
    const store = await import('../../server/lib/configStore.js');
    await store.updateSection('featureToggles', { kycApprovalsEnabled: true });
    expect((await store.readWorkflowControls()).kycApprovalsEnabled).toBe(true);
    vi.stubEnv('NODE_ENV', 'production');
    expect((await store.readWorkflowControls()).kycApprovalsEnabled).toBe(false);
  });

  it('keeps unrelated saves out of the dedicated workflow record', async () => {
    const values = vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) }));
    db.insert.mockReturnValue({ values });
    const store = await import('../../server/lib/configStore.js');
    await store.updateSection('theme', { mode: 'light' });
    expect(values).toHaveBeenCalledOnce();
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ key: 'app_config' }));
  });
});
