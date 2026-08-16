import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getEffectiveCustomerFeatures, getEffectiveInternalRoleFeatures, getPublicPlatformFeatures, requireEnabledCustomerFeature } from '../../server/lib/platformFeatureControls';
import { EMPTY_PLATFORM_FEATURE_ACCESS, normalizePlatformFeatureAccess, type PlatformFeatureAccessScopes } from '../../shared/platformFeatures';

const featureConfig = vi.hoisted(() => ({
  platformFeatures: {} as Record<string, boolean>,
  featureAccess: undefined as PlatformFeatureAccessScopes | undefined,
}));

vi.mock('../../server/lib/configStore', () => ({ getSection: () => featureConfig }));

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

function response() {
  const state: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) { state.status = code; return this; },
    json(body: unknown) { state.body = body; return this; },
  } as unknown as Response;
  return { res, state };
}

describe('platform feature controls', () => {
  beforeEach(() => {
    featureConfig.platformFeatures = {};
    featureConfig.featureAccess = structuredClone(EMPTY_PLATFORM_FEATURE_ACCESS);
  });

  it('publishes only the stable boolean feature catalogue', () => {
    const features = getPublicPlatformFeatures();
    expect(Object.keys(features)).toHaveLength(21);
    expect(features.accounts).toBe(true);
    expect(features.registration).toBe(true);
    expect(features.rewards).toBe(false);
    expect(Object.values(features).every(value => typeof value === 'boolean')).toBe(true);
  });

  it('fails closed for a disabled customer API without deleting records', () => {
    const next = vi.fn() as NextFunction;
    const blocked = response();
    requireEnabledCustomerFeature({ path: '/rewards' } as Request, blocked.res, next);
    expect(blocked.state.status).toBe(503);
    expect(blocked.state.body).toMatchObject({ code: 'FEATURE_DISABLED', feature: 'rewards' });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows enabled and unclassified customer APIs', () => {
    const enabledNext = vi.fn() as NextFunction;
    requireEnabledCustomerFeature({ path: '/accounts' } as Request, response().res, enabledNext);
    expect(enabledNext).toHaveBeenCalledOnce();
    const securityNext = vi.fn() as NextFunction;
    requireEnabledCustomerFeature({ path: '/security/sessions' } as Request, response().res, securityNext);
    expect(securityNext).toHaveBeenCalledOnce();
  });

  it('applies plan, country, and customer restrictions without bypassing global controls', () => {
    featureConfig.platformFeatures.cards = false;
    featureConfig.featureAccess = {
      ...structuredClone(EMPTY_PLATFORM_FEATURE_ACCESS),
      plans: { standard: { transfers: false }, premium: {}, elite: {} },
      countries: { GB: { wallets: false } },
      users: { usr_12345678: { accounts: false, cards: true } },
    };
    const effective = getEffectiveCustomerFeatures({ id: 'usr_12345678', requestedProduct: 'digital-banking-standard', accountTier: 'personal', country: 'gb' });
    expect(effective).toMatchObject({ plan: 'standard', country: 'GB' });
    expect(effective.features.transfers).toBe(false);
    expect(effective.features.wallets).toBe(false);
    expect(effective.features.accounts).toBe(false);
    expect(effective.features.cards).toBe(false);
  });

  it('enforces internal-role restrictions and tolerates legacy configs without scopes', () => {
    featureConfig.featureAccess = { ...structuredClone(EMPTY_PLATFORM_FEATURE_ACCESS), internalRoles: { SUPPORT_ADMIN: { investments: false } } };
    expect(getEffectiveInternalRoleFeatures('support_admin').investments).toBe(false);
    featureConfig.featureAccess = undefined;
    expect(getEffectiveInternalRoleFeatures('support_admin').investments).toBe(true);
  });

  it('normalizes only controlled identifiers and known boolean feature overrides', () => {
    const normalized = normalizePlatformFeatureAccess({
      plans: { standard: { accounts: false, unknown: false } },
      users: { usr_12345678: { transfers: false }, invalid: { cards: false } },
      countries: { gb: { wallets: false }, GBR: { cards: false } },
      internalRoles: { support_admin: { support: false }, 'bad role': { accounts: false } },
    });
    expect(normalized.plans.standard).toEqual({ accounts: false });
    expect(normalized.users).toEqual({ usr_12345678: { transfers: false } });
    expect(normalized.countries).toEqual({ GB: { wallets: false } });
    expect(normalized.internalRoles).toEqual({ SUPPORT_ADMIN: { support: false } });
  });

  it('is wired through admin, navigation, route, and API boundaries', () => {
    expect(read('src/pages/admin/config.tsx')).toContain('Customer modules');
    expect(read('src/pages/admin/config.tsx')).toContain('Account-plan access');
    expect(read('src/pages/admin/config.tsx')).toContain('Targeted access restrictions');
    expect(read('src/components/CustomerMobileNav.tsx')).toContain('visibleMore');
    expect(read('src/routes.tsx')).toContain('FeatureOnly feature="registration"');
    expect(read('src/server/entry.ts')).toContain("app.use('/api/users', requireEnabledCustomerFeature)");
    expect(read('src/server/entry.ts')).toContain('app.get("/api/users/features", users_features_get)');
    expect(read('src/server/entry.ts')).toContain('app.get("/api/admin/features", admin_features_get)');
    expect(read('src/server/lib/platformFeatureControls.ts')).not.toContain('LIVE_PROVIDER_ADAPTERS_IMPLEMENTED = true');
  });
});
