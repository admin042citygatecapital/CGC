import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  configured: true,
  failWrite: false,
  value: null as Record<string, unknown> | null,
  getDb: vi.fn(),
}));

vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => database.configured,
  getDb: database.getDb,
}));

function databaseAdapter() {
  return {
    select: () => ({
      from: () => ({
        where: async () => database.value === null ? [] : [{ key: 'app_config', value: database.value }],
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
  };
}

describe('Configuration Center durability', () => {
  beforeEach(() => {
    vi.resetModules();
    database.configured = true;
    database.failWrite = false;
    database.value = null;
    database.getDb.mockReset();
    database.getDb.mockImplementation(databaseAdapter);
  });

  it('does not publish a cache update when PostgreSQL rejects the write', async () => {
    const store = await import('../../server/lib/configStore.js');
    const before = store.getSection('theme');
    database.failWrite = true;

    await expect(store.updateSection('theme', { mode: 'light' })).rejects.toThrow('persistence unavailable');

    expect(store.getSection('theme')).toEqual(before);
    expect(database.value).toBeNull();
  });

  it('returns success only after the updated configuration is durable', async () => {
    const store = await import('../../server/lib/configStore.js');

    const updated = await store.updateSection('theme', { mode: 'light' });

    expect(updated.theme.mode).toBe('light');
    expect(database.value).toMatchObject({ theme: { mode: 'light' } });
    expect(store.getSection('theme').mode).toBe('light');
  });

  it('preserves the in-memory development fallback when no database is configured', async () => {
    database.configured = false;
    const store = await import('../../server/lib/configStore.js');

    await expect(store.updateSection('theme', { mode: 'light' })).resolves.toMatchObject({
      theme: { mode: 'light' },
    });

    expect(store.getSection('theme').mode).toBe('light');
    expect(database.getDb).not.toHaveBeenCalled();
  });
});
