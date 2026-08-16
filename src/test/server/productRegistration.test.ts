import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getProductBySlug, isAccountPlanProduct, PRODUCT_CATALOGUE } from '../../lib/productCatalogue';

describe('product-specific registration', () => {
  it('provides a unique direct-registration slug for every published product', () => {
    expect(PRODUCT_CATALOGUE).toHaveLength(11);
    expect(new Set(PRODUCT_CATALOGUE.map(product => product.slug)).size).toBe(11);
    for (const product of PRODUCT_CATALOGUE) expect(getProductBySlug(product.slug)).toEqual(product);
  });

  it('maps only account products to non-personal account tiers', () => {
    expect(getProductBySlug('savings-account')?.accountTier).toBe('savings');
    expect(getProductBySlug('business-account')?.accountTier).toBe('business');
    expect(getProductBySlug('digital-asset-wallet')?.accountTier).toBe('personal');
    expect(getProductBySlug('unknown')).toBeUndefined();
  });

  it('validates and audits the requested product on the server', () => {
    const route = readFileSync('src/server/api/users/register/POST.ts', 'utf8');
    expect(route).toContain('getProductBySlug(raw.requestedProduct)');
    expect(route).toContain('requestedProduct: product.slug');
    expect(route).toContain('accountTier: product.accountTier');
    expect(route).toContain('register_plan_unavailable');
    expect(route).toContain('readWebsiteSettings');
  });

  it('maps every configurable account plan to a registration product', () => {
    const planProducts = PRODUCT_CATALOGUE.filter(isAccountPlanProduct);
    expect(planProducts.map(product => product.planId)).toEqual(['standard', 'premium', 'elite']);
    expect(planProducts.map(product => product.slug)).toEqual([
      'digital-banking-standard', 'digital-banking-premium', 'digital-banking-elite',
    ]);
  });

  it('creates the customer and registration case in one database transaction', () => {
    const store = readFileSync('src/server/lib/userStore.ts', 'utf8');
    const route = readFileSync('src/server/api/users/register/POST.ts', 'utf8');
    const page = readFileSync('src/pages/register.tsx', 'utf8');
    const atomic = store.slice(store.indexOf('export async function createUserWithRegistrationCase'), store.indexOf('export async function updateUser'));
    expect(atomic).toContain('db.transaction(async (tx) =>');
    expect(atomic).toContain('tx.insert(users)');
    expect(atomic).toContain('tx.insert(onboardingCases)');
    expect(atomic).toContain('tx.insert(onboardingEvents)');
    expect(atomic).toContain("action: 'registration_received'");
    const eventInsert = atomic.slice(atomic.indexOf('tx.insert(onboardingEvents)'), atomic.indexOf('return { user:'));
    expect(eventInsert).not.toMatch(/passwordHash|emailVerifyToken|sessionToken/);
    expect(route).toContain('createUserWithRegistrationCase');
    expect(route).toContain('applicationReference');
    expect(route).toContain('intakePosition');
    expect(page).toContain('Application reference');
    expect(page).toContain('Intake #');
  });
});
