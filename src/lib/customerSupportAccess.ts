export const CUSTOMER_SUPPORT_CATEGORIES = [
  'Account Access',
  'Identity Verification',
  'Transfer Workspace',
  'Card Workspace',
  'Trading Workspace',
  'Technical Support',
  'General',
] as const;

export const ONBOARDING_SUPPORT_CATEGORIES = [
  'Identity Verification',
  'Account Access',
  'Technical Support',
] as const;

export type CustomerSupportCategory = (typeof CUSTOMER_SUPPORT_CATEGORIES)[number];

export function getCustomerSupportSurface(pathname: string) {
  const onboarding = pathname === '/onboarding/support';
  return {
    onboarding,
    categories: onboarding ? ONBOARDING_SUPPORT_CATEGORIES : CUSTOMER_SUPPORT_CATEGORIES,
    defaultCategory: onboarding ? 'Identity Verification' as const : 'General' as const,
    backHref: onboarding ? '/kyc' as const : '/dashboard' as const,
    backLabel: onboarding ? 'Back to identity onboarding' : 'Back to dashboard',
    eyebrow: onboarding ? 'Restricted onboarding support' : 'Customer care',
    heading: onboarding ? 'Identity verification support' : 'Support centre',
  };
}
