import { beforeEach, describe, expect, it, vi } from 'vitest';
import { workflowControlPatch } from '../../shared/workflowControlPatch.js';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({ configured: false, transaction: vi.fn() }));
vi.mock('../../server/db/db.js', () => ({ isDatabaseConfigured: () => mocks.configured, getDb: () => ({ transaction: mocks.transaction }) }));
beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); vi.stubEnv('NODE_ENV', 'development'); mocks.configured = false; });

describe('deliberate workflow writes', () => {
  it('omits untouched protected values from an unrelated full-form save', () => {
    const baseline = { kycApprovalsEnabled: true, sandboxFinancialControlsEnabled: true, darkModeEnabled: false };
    expect(workflowControlPatch({ ...baseline, darkModeEnabled: true }, baseline)).toEqual({ darkModeEnabled: true });
  });
  it('submits only the protected switch actually changed', () => {
    const baseline = { kycApprovalsEnabled: false, sandboxFinancialControlsEnabled: true };
    expect(workflowControlPatch({ ...baseline, kycApprovalsEnabled: true }, baseline)).toEqual({ kycApprovalsEnabled: true });
  });
  it('does not re-enable controls when a stale page saves another feature', async () => {
    const store = await import('../../server/lib/configStore.js');
    await store.updateSection('featureToggles', { kycApprovalsEnabled: true, sandboxFinancialControlsEnabled: true });
    const baseline = { ...store.getConfig().featureToggles };
    await store.resetSection('featureToggles');
    await store.updateSection('featureToggles', workflowControlPatch({ ...baseline, darkModeEnabled: false }, baseline));
    expect(await store.readWorkflowControls()).toEqual({ kycApprovalsEnabled: false, sandboxFinancialControlsEnabled: false });
  });
  it('rejects an outdated explicit save and reset without changing other settings', async () => {
    const store = await import('../../server/lib/configStore.js');
    const old = (await store.readWorkflowState()).version!;
    await store.updateSection('featureToggles', { kycApprovalsEnabled: true }, old);
    await store.resetSection('featureToggles', (await store.readWorkflowState()).version!);
    const before = store.getConfig();
    await expect(store.updateSection('featureToggles', { sandboxFinancialControlsEnabled: true, darkModeEnabled: false }, old)).rejects.toThrow('Workflow controls changed');
    await expect(store.resetSection('featureToggles', old)).rejects.toThrow('Workflow controls changed');
    expect(store.getConfig()).toEqual(before);
  });
  it.each([true, false])('uses an atomic database predicate and publishes cache only on commit: %s', async succeeds => {
    mocks.configured = true;
    const values = vi.fn(() => ({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined), onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) }));
    const where = vi.fn((_condition: import('drizzle-orm').SQL) => ({ returning: vi.fn().mockResolvedValue(succeeds ? [{ key: 'admin_workflow_controls' }] : []) }));
    const set = vi.fn(() => ({ where }));
    mocks.transaction.mockImplementation(async callback => callback({ insert: () => ({ values }), update: () => ({ set }) }));
    const store = await import('../../server/lib/configStore.js');
    const pending = store.updateSection('featureToggles', { kycApprovalsEnabled: true }, 'expected-version');
    if (succeeds) await pending;
    else await expect(pending).rejects.toThrow('Workflow controls changed');
    const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.sql).toContain('coalesce(');
    expect(query.params).toContain('expected-version');
    expect(query.params).toContain('admin_workflow_controls');
    expect(values).toHaveBeenCalledTimes(succeeds ? 2 : 1);
    expect(store.getConfig().featureToggles.kycApprovalsEnabled).toBe(succeeds);
  });
});
