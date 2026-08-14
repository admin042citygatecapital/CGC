export interface AccountPlanConfig {
  id: 'standard' | 'premium' | 'elite';
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  description: string;
  features: string[];
  limits: string;
  ctaLabel: string;
  ctaLink: string;
  visible: boolean;
  eligibility: string;
}

export const DEFAULT_ACCOUNT_PLANS: AccountPlanConfig[] = [
  {
    id: 'standard', name: 'Standard', monthlyPrice: 'Free', annualPrice: 'Free',
    description: 'A simple, modern foundation for viewing and organising financial activity from one secure dashboard.',
    features: ['Multi-Currency Experience', 'Digital Wallets', 'Transfer Workflows', 'Smart Card Experience', 'Card & Spending Controls', 'Financial Dashboard', 'Smart Analytics', 'Bill Payments', 'Customer Support', 'Enhanced Security'],
    limits: 'Essential account and support access.', ctaLabel: 'Explore Standard',
    ctaLink: '/register?product=digital-banking-standard', visible: true,
    eligibility: 'Individuals beginning their digital financial journey and customers with straightforward financial needs.',
  },
  {
    id: 'premium', name: 'Premium', monthlyPrice: '$9', annualPrice: '$90',
    description: 'Expanded visibility, flexibility and control for a more active financial life.',
    features: ['Multi-Currency Experience', 'Digital Wallets', 'Transfer Workflows', 'Smart Card Experience', 'Card & Spending Controls', 'Financial Dashboard', 'Smart Analytics', 'Portfolio & Market View', 'Rewards & Benefits', 'Bill Payments', 'Customer Support', 'Enhanced Security'],
    limits: 'Enhanced eligible account, transfer and support access.', ctaLabel: 'Explore Premium',
    ctaLink: '/register?product=digital-banking-premium', visible: true,
    eligibility: 'Professionals, frequent travellers, entrepreneurs and customers who want more sophisticated tools.',
  },
  {
    id: 'elite', name: 'Elite', monthlyPrice: '$29', annualPrice: '$290',
    description: 'Premium digital capabilities combined with a higher-touch service experience.',
    features: ['Multi-Currency Experience', 'Digital Wallets', 'Transfer Workflows', 'Smart Card Experience', 'Card & Spending Controls', 'Financial Dashboard', 'Smart Analytics', 'Portfolio & Market View', 'Rewards & Benefits', 'Bill Payments', 'Customer Support', 'Relationship Support', 'White-Glove Onboarding', 'Concierge Services', 'Business & API Capabilities', 'Advanced Reporting', 'Enhanced Security'],
    limits: 'Personalised service and advanced capabilities subject to eligibility.', ctaLabel: 'Contact Elite Team',
    ctaLink: '/contact?service=elite-digital-banking', visible: true,
    eligibility: 'Executives, business owners and eligible professional clients with sophisticated financial requirements.',
  },
];

const IDS = new Set(['standard', 'premium', 'elite']);
const clean = (value: unknown, fallback: string, max: number) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback;
const LEGACY_FEATURES: Record<string, string[]> = {
  'Financial Analytics': ['Financial Dashboard', 'Smart Analytics', 'Bill Payments'],
  'Layered Security': ['Enhanced Security'],
  'Concierge & Onboarding': ['White-Glove Onboarding', 'Concierge Services'],
};

function normalizeFeatures(value: unknown, fallback: string[]) {
  const source = Array.isArray(value) ? value : fallback;
  return [...new Set(source
    .filter((feature): feature is string => typeof feature === 'string')
    .flatMap(feature => LEGACY_FEATURES[feature.trim()] ?? [feature.trim()])
    .filter(Boolean))]
    .slice(0, 30)
    .map(feature => feature.slice(0, 80));
}

export function normalizeAccountPlans(value: unknown): AccountPlanConfig[] {
  if (!Array.isArray(value)) return DEFAULT_ACCOUNT_PLANS.map(plan => ({ ...plan, features: [...plan.features] }));
  const source = new Map(value.filter(item => item && typeof item === 'object' && IDS.has(String((item as { id?: unknown }).id))).map(item => [String((item as { id: unknown }).id), item as Record<string, unknown>]));
  return DEFAULT_ACCOUNT_PLANS.map(fallback => {
    const item = source.get(fallback.id);
    if (!item) return { ...fallback, features: [...fallback.features] };
    const features = normalizeFeatures(item.features, fallback.features);
    const rawLink = clean(item.ctaLink, fallback.ctaLink, 180);
    const ctaLink = rawLink.startsWith('/') || rawLink.startsWith('https://citygate.capital') ? rawLink : fallback.ctaLink;
    return {
      id: fallback.id,
      name: clean(item.name, fallback.name, 50),
      monthlyPrice: clean(item.monthlyPrice, fallback.monthlyPrice, 30),
      annualPrice: clean(item.annualPrice, fallback.annualPrice, 30),
      description: clean(item.description, fallback.description, 400),
      features: features.length ? features : [...fallback.features],
      limits: clean(item.limits, fallback.limits, 300),
      ctaLabel: clean(item.ctaLabel, fallback.ctaLabel, 60),
      ctaLink,
      visible: typeof item.visible === 'boolean' ? item.visible : fallback.visible,
      eligibility: clean(item.eligibility, fallback.eligibility, 400),
    };
  });
}
