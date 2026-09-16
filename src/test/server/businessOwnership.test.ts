/**
 * Business ownership projection (migration 0103) - City Gate Capital.
 *
 * Drives the real store over a scripted database double: the wizard step JSON
 * must survive the round-trip into the relational projection that the admin
 * review console reads, and the migration must keep those tables private.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configured: false,
  selectQueue: [] as unknown[][],
  inserts: [] as unknown[],
  deletes: 0,
}));

vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => mocks.configured,
  getDb: () => ({
    select: () => ({
      from: () => {
        const rows = mocks.selectQueue.shift() ?? [];
        return {
          where: () => ({
            limit: () => Promise.resolve(rows),
            orderBy: () => Promise.resolve(rows),
          }),
        };
      },
    }),
    delete: () => ({
      where: () => {
        mocks.deletes += 1;
        return Promise.resolve(undefined);
      },
    }),
    insert: () => ({
      values: (values: unknown) => {
        mocks.inserts.push(values);
        return Promise.resolve(undefined);
      },
    }),
  }),
}));

beforeEach(() => {
  vi.resetModules();
  mocks.configured = false;
  mocks.selectQueue = [];
  mocks.inserts = [];
  mocks.deletes = 0;
});

async function loadStore() {
  return import('../../server/lib/applicationsStore.js');
}

const businessAppRow = {
  id: 'appl_biz1',
  accountType: 'BUSINESS',
  steps: {
    business: {
      legalName: 'Gate Holdings Ltd',
      tradingName: 'Gate',
      entityType: 'LTD',
      incorporationCountry: 'MT',
      registrationNumber: 'C 12345',
      website: 'https://gate.example',
      requiredCurrencies: 'EUR',
    },
    personal: { firstName: 'Anna', lastName: 'Bell' },
    ownership: {
      directors: 'Dir One - CFO',
      teamAccess: 'Team Mate - Approver',
      beneficialOwners: 'Jane Doe - 45% owner',
    },
  },
};

describe('migration 0103 - business ownership projection tables', () => {
  const migration = readFileSync('src/server/db/migrations/0103_business_ownership.sql', 'utf8');

  it('creates the three projection tables with constraints and indexes', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS business_profiles');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS business_members');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS beneficial_owners');
    expect(migration).toContain('business_profiles_application_idx');
    expect(migration).toContain('business_members_application_idx');
    expect(migration).toContain('beneficial_owners_application_idx');
    expect(migration).toContain('CHECK (ownership_pct >= 0 AND ownership_pct <= 100)');
  });

  it('keeps the projection private exactly like the 0102 pattern', () => {
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE business_profiles, business_members, beneficial_owners FROM PUBLIC');
    expect(migration).toContain('FROM anon');
    expect(migration).toContain('FROM authenticated');
    expect(migration).not.toContain('storage.buckets');
  });
});

describe('persistBusinessOwnership - wizard steps to relational projection', () => {
  it('projects profile, representative, members and owners from the steps', async () => {
    mocks.configured = true;
    mocks.selectQueue = [[businessAppRow]];
    const { persistBusinessOwnership } = await loadStore();
    await persistBusinessOwnership('appl_biz1');
    expect(mocks.deletes).toBe(3);
    const profile = mocks.inserts[0] as Record<string, unknown>;
    expect(profile).toMatchObject({
      applicationId: 'appl_biz1',
      legalName: 'Gate Holdings Ltd',
      tradingName: 'Gate',
      entityType: 'LTD',
      requiredCurrencies: 'EUR',
    });
    const members = mocks.inserts[1] as Array<Record<string, unknown>>;
    expect(members).toHaveLength(3);
    expect(members[0]).toMatchObject({ memberKind: 'representative', teamRole: 'Owner', fullName: 'Anna Bell' });
    expect(members[1]).toMatchObject({ memberKind: 'director', teamRole: null, fullName: 'Dir One', detail: 'CFO' });
    expect(members[2]).toMatchObject({ memberKind: 'team', teamRole: 'Approver', fullName: 'Team Mate' });
    const owners = mocks.inserts[2] as Array<Record<string, unknown>>;
    expect(owners).toEqual([expect.objectContaining({ fullName: 'Jane Doe', ownershipPct: 45 })]);
  });

  it('does nothing when the business step has no legal name yet', async () => {
    mocks.configured = true;
    mocks.selectQueue = [[{ id: 'appl_biz2', accountType: 'BUSINESS', steps: { business: {} } }]];
    const { persistBusinessOwnership } = await loadStore();
    await persistBusinessOwnership('appl_biz2');
    expect(mocks.deletes).toBe(0);
    expect(mocks.inserts).toHaveLength(0);
  });

  it('rejects an unknown application', async () => {
    mocks.configured = true;
    mocks.selectQueue = [[]];
    const { persistBusinessOwnership } = await loadStore();
    await expect(persistBusinessOwnership('appl_missing')).rejects.toThrow('Application not found.');
  });
});

describe('getBusinessOwnership - admin review projection read', () => {
  it('returns an empty projection while the database is offline', async () => {
    const { getBusinessOwnership } = await loadStore();
    await expect(getBusinessOwnership('appl_biz1')).resolves.toEqual({
      profile: null, representative: null, members: [], owners: [],
    });
  });

  it('extracts the representative and reads back the stored rows', async () => {
    mocks.configured = true;
    const profileRow = { legalName: 'Gate Holdings Ltd', tradingName: null };
    const memberRows = [
      { memberKind: 'representative', teamRole: 'Owner', fullName: 'Anna Bell', detail: null },
      { memberKind: 'director', teamRole: null, fullName: 'Dir One', detail: 'CFO' },
    ];
    const ownerRows = [{ fullName: 'Jane Doe', ownershipPct: 45 }];
    mocks.selectQueue = [[profileRow], memberRows, ownerRows];
    const { getBusinessOwnership } = await loadStore();
    const projection = await getBusinessOwnership('appl_biz1');
    expect(projection.profile).toMatchObject({ legalName: 'Gate Holdings Ltd' });
    expect(projection.representative).toEqual({ fullName: 'Anna Bell', detail: null });
    expect(projection.members).toEqual([{ memberKind: 'director', teamRole: null, fullName: 'Dir One', detail: 'CFO' }]);
    expect(projection.owners).toEqual([{ fullName: 'Jane Doe', ownershipPct: 45 }]);
  });
});

describe('sanitizeSteps - defense in depth for legacy step data', () => {
  it('drops credential fields wherever they appear', async () => {
    const { sanitizeSteps } = await loadStore();
    const cleaned = sanitizeSteps({ contact: { email: 'a@b.test', password: 'secret', otp: '123456' } });
    expect(cleaned).toEqual({ contact: { email: 'a@b.test' } });
  });
});
