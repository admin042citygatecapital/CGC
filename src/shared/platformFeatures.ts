export const PLATFORM_FEATURE_KEYS = [
  'accounts', 'multiCurrency', 'fx', 'transfers', 'cards', 'wallets',
  'investments', 'markets', 'analytics', 'savingsGoals', 'businessBanking',
  'rewards', 'statements', 'supportChat', 'kyc', 'registration',
  'notifications', 'emails', 'beneficiaries', 'payments', 'support',
] as const;

export type PlatformFeatureKey = (typeof PLATFORM_FEATURE_KEYS)[number];
export type PlatformFeatures = Record<PlatformFeatureKey, boolean>;
export type PlatformFeatureOverrides = Partial<PlatformFeatures>;
export type CustomerPlanId = 'standard' | 'premium' | 'elite';

export interface PlatformFeatureAccessScopes {
  plans: Record<CustomerPlanId, PlatformFeatureOverrides>;
  users: Record<string, PlatformFeatureOverrides>;
  countries: Record<string, PlatformFeatureOverrides>;
  internalRoles: Record<string, PlatformFeatureOverrides>;
}

export const EMPTY_PLATFORM_FEATURE_ACCESS: PlatformFeatureAccessScopes = {
  plans: { standard: {}, premium: {}, elite: {} },
  users: {},
  countries: {},
  internalRoles: {},
};

export const DEFAULT_PLATFORM_FEATURES: PlatformFeatures = {
  accounts: true,
  multiCurrency: true,
  fx: true,
  transfers: true,
  cards: true,
  wallets: true,
  investments: true,
  markets: true,
  analytics: true,
  savingsGoals: true,
  businessBanking: true,
  rewards: false,
  statements: true,
  supportChat: true,
  kyc: true,
  registration: true,
  notifications: true,
  emails: true,
  beneficiaries: true,
  payments: true,
  support: true,
};

function normalizeOverrides(value: unknown): PlatformFeatureOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return PLATFORM_FEATURE_KEYS.reduce<PlatformFeatureOverrides>((result, key) => {
    if (typeof source[key] === 'boolean') result[key] = source[key] as boolean;
    return result;
  }, {});
}

function normalizeScopeMap(
  value: unknown,
  normalizeIdentifier: (identifier: string) => string,
  isValidIdentifier: (identifier: string) => boolean,
): Record<string, PlatformFeatureOverrides> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 250);
  return entries.reduce<Record<string, PlatformFeatureOverrides>>((result, [rawIdentifier, overrides]) => {
    const identifier = normalizeIdentifier(rawIdentifier.trim());
    if (!isValidIdentifier(identifier)) return result;
    const normalized = normalizeOverrides(overrides);
    if (Object.keys(normalized).length > 0) result[identifier] = normalized;
    return result;
  }, {});
}

export function normalizePlatformFeatureAccess(value: unknown): PlatformFeatureAccessScopes {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const plans = source.plans && typeof source.plans === 'object' && !Array.isArray(source.plans)
    ? source.plans as Record<string, unknown>
    : {};
  return {
    plans: {
      standard: normalizeOverrides(plans.standard),
      premium: normalizeOverrides(plans.premium),
      elite: normalizeOverrides(plans.elite),
    },
    users: normalizeScopeMap(source.users, identifier => identifier, identifier => /^usr_[a-z0-9]{8,64}$/i.test(identifier)),
    countries: normalizeScopeMap(source.countries, identifier => identifier.toUpperCase(), identifier => /^[A-Z]{2}$/.test(identifier)),
    internalRoles: normalizeScopeMap(source.internalRoles, identifier => identifier.toUpperCase(), identifier => /^[A-Z][A-Z0-9_]{1,39}$/.test(identifier)),
  };
}
