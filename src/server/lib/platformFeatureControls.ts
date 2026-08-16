import type { NextFunction, Request, Response } from 'express';
import {
  DEFAULT_PLATFORM_FEATURES,
  EMPTY_PLATFORM_FEATURE_ACCESS,
  PLATFORM_FEATURE_KEYS,
  type CustomerPlanId,
  type PlatformFeatureKey,
  type PlatformFeatureOverrides,
  type PlatformFeatures,
} from '../../shared/platformFeatures.js';
import { getSection } from './configStore.js';
import type { UserRecord } from './userStore.js';

export function getPublicPlatformFeatures(): PlatformFeatures {
  const configured = getSection('featureToggles').platformFeatures ?? {};
  return PLATFORM_FEATURE_KEYS.reduce<PlatformFeatures>((features, key) => {
    features[key] = configured[key] ?? DEFAULT_PLATFORM_FEATURES[key];
    return features;
  }, { ...DEFAULT_PLATFORM_FEATURES });
}

export function isPlatformFeatureEnabled(feature: PlatformFeatureKey): boolean {
  return getPublicPlatformFeatures()[feature];
}

export function customerPlanId(user: Pick<UserRecord, 'requestedProduct' | 'accountTier'>): CustomerPlanId {
  const requested = (user.requestedProduct ?? '').toLowerCase();
  if (requested.includes('elite')) return 'elite';
  if (requested.includes('premium')) return 'premium';
  return 'standard';
}

function applyRestrictions(features: PlatformFeatures, overrides: PlatformFeatureOverrides | undefined): PlatformFeatures {
  if (!overrides) return features;
  return PLATFORM_FEATURE_KEYS.reduce<PlatformFeatures>((result, key) => {
    // Narrower scopes may restrict a feature, but cannot reactivate a globally disabled capability.
    result[key] = result[key] && overrides[key] !== false;
    return result;
  }, { ...features });
}

export function getEffectiveCustomerFeatures(
  user: Pick<UserRecord, 'id' | 'requestedProduct' | 'accountTier' | 'country'>,
): { features: PlatformFeatures; plan: CustomerPlanId; country: string | null } {
  const access = getSection('featureToggles').featureAccess ?? EMPTY_PLATFORM_FEATURE_ACCESS;
  const plan = customerPlanId(user);
  const country = user.country?.trim().toUpperCase() || null;
  let features = getPublicPlatformFeatures();
  features = applyRestrictions(features, access.plans[plan]);
  if (country) features = applyRestrictions(features, access.countries[country]);
  features = applyRestrictions(features, access.users[user.id]);
  return { features, plan, country };
}

export function getEffectiveInternalRoleFeatures(role: string): PlatformFeatures {
  const access = getSection('featureToggles').featureAccess ?? EMPTY_PLATFORM_FEATURE_ACCESS;
  return applyRestrictions(getPublicPlatformFeatures(), access.internalRoles[role.trim().toUpperCase()]);
}

const CUSTOMER_API_FEATURES: Array<[prefix: string, feature: PlatformFeatureKey]> = [
  ['/register', 'registration'], ['/onboarding', 'kyc'], ['/kyc-document', 'kyc'],
  ['/accounts', 'accounts'], ['/balance', 'accounts'], ['/transfers', 'transfers'],
  ['/transfer', 'transfers'], ['/beneficiaries', 'beneficiaries'], ['/cards', 'cards'],
  ['/wallet-overview', 'wallets'], ['/swap', 'wallets'], ['/withdraw', 'wallets'],
  ['/deposit', 'wallets'], ['/trading', 'investments'], ['/goals', 'savingsGoals'],
  ['/bills', 'payments'], ['/rewards', 'rewards'], ['/notifications', 'notifications'],
  ['/support', 'support'],
];

export function requireEnabledCustomerFeature(req: Request, res: Response, next: NextFunction): void {
  const path = req.path.endsWith('/') && req.path.length > 1 ? req.path.slice(0, -1) : req.path;
  const match = CUSTOMER_API_FEATURES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  const enabled = match && req.customerUser
    ? getEffectiveCustomerFeatures(req.customerUser).features[match[1]]
    : match
      ? isPlatformFeatureEnabled(match[1])
      : true;
  if (!match || enabled) {
    next();
    return;
  }
  res.status(503).json({
    error: 'This service is currently unavailable. Please choose another service or contact support.',
    code: 'FEATURE_DISABLED',
    feature: match[1],
  });
}
