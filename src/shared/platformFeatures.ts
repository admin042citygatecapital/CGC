export const PLATFORM_FEATURE_KEYS = [
  'accounts', 'multiCurrency', 'fx', 'transfers', 'cards', 'wallets',
  'investments', 'markets', 'analytics', 'savingsGoals', 'businessBanking',
  'rewards', 'statements', 'supportChat', 'kyc', 'registration',
  'notifications', 'emails', 'beneficiaries', 'payments', 'support',
] as const;

export type PlatformFeatureKey = (typeof PLATFORM_FEATURE_KEYS)[number];
export type PlatformFeatures = Record<PlatformFeatureKey, boolean>;

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
