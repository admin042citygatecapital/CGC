import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { getPublicPlatformFeatures, requireEnabledCustomerFeature } from '../../server/lib/platformFeatureControls';

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

  it('is wired through admin, navigation, route, and API boundaries', () => {
    expect(read('src/pages/admin/config.tsx')).toContain('Customer modules');
    expect(read('src/components/CustomerMobileNav.tsx')).toContain('visibleMore');
    expect(read('src/routes.tsx')).toContain('FeatureOnly feature="registration"');
    expect(read('src/server/entry.ts')).toContain("app.use('/api/users', requireEnabledCustomerFeature)");
    expect(read('src/server/lib/platformFeatureControls.ts')).not.toContain('LIVE_PROVIDER_ADAPTERS_IMPLEMENTED = true');
  });
});
