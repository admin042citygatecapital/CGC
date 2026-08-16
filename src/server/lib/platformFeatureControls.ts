import type { NextFunction, Request, Response } from 'express';
import {
  DEFAULT_PLATFORM_FEATURES,
  PLATFORM_FEATURE_KEYS,
  type PlatformFeatureKey,
  type PlatformFeatures,
} from '../../shared/platformFeatures.js';
import { getSection } from './configStore.js';

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
  if (!match || isPlatformFeatureEnabled(match[1])) {
    next();
    return;
  }
  res.status(503).json({
    error: 'This service is currently unavailable. Please choose another service or contact support.',
    code: 'FEATURE_DISABLED',
    feature: match[1],
  });
}
