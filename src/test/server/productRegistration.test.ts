import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getProductBySlug, PRODUCT_CATALOGUE } from '../../lib/productCatalogue';

describe('product-specific registration', () => {
  it('provides a unique direct-registration slug for every published product', () => {
    expect(PRODUCT_CATALOGUE).toHaveLength(8);
    expect(new Set(PRODUCT_CATALOGUE.map(product => product.slug)).size).toBe(8);
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
  });
});
