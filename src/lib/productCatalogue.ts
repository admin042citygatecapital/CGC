export const PRODUCT_CATALOGUE = [
  { slug: 'digital-banking-standard', label: 'Standard Account Plan', accountTier: 'personal', planId: 'standard' },
  { slug: 'digital-banking-premium', label: 'Premium Account Plan', accountTier: 'personal', planId: 'premium' },
  { slug: 'digital-banking-elite', label: 'Elite Account Plan', accountTier: 'personal', planId: 'elite' },
  { slug: 'personal-account', label: 'Personal Account', accountTier: 'personal' },
  { slug: 'savings-account', label: 'Savings Account', accountTier: 'savings' },
  { slug: 'business-account', label: 'Business Account', accountTier: 'business' },
  { slug: 'multi-currency-wallet', label: 'Multi-Currency Service Wallet', accountTier: 'personal' },
  { slug: 'digital-asset-wallet', label: 'Digital-Asset Wallet', accountTier: 'personal' },
  { slug: 'markets-investments', label: 'Markets & Investments', accountTier: 'personal' },
  { slug: 'retirement-beneficiaries', label: 'Retirement & Beneficiaries', accountTier: 'personal' },
  { slug: 'tax-document-centre', label: 'Tax Document Centre', accountTier: 'personal' },
] as const;

export type ProductSlug = typeof PRODUCT_CATALOGUE[number]['slug'];
export type ProductAccountTier = typeof PRODUCT_CATALOGUE[number]['accountTier'];

export type ProductCatalogueItem = {
  slug: ProductSlug;
  label: string;
  accountTier: ProductAccountTier;
  planId?: AccountPlanProductId;
};

export type AccountPlanProductId = 'standard' | 'premium' | 'elite';

export function isAccountPlanProduct(product: (typeof PRODUCT_CATALOGUE)[number]): product is (typeof PRODUCT_CATALOGUE)[number] & { planId: AccountPlanProductId } {
  return 'planId' in product;
}

export function getProductBySlug(value: unknown) {
  if (typeof value !== 'string') return undefined;
  return PRODUCT_CATALOGUE.find(product => product.slug === value.trim().toLowerCase());
}
