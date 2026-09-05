/** Reviewed product scope. Environment switches cannot enable live finance. */
export const LIVE_FINANCIAL_ACTIVITY_IN_SCOPE = false;
export const SUMSUB_VERIFICATION_SCOPE = 'sandbox_kyc_only' as const;

const EXCLUDED_ROUTES = [
  '/admin/accounts', '/admin/cards', '/admin/crypto', '/admin/trading',
  '/admin/transfers', '/admin/transactions', '/admin/reconciliation',
  '/admin/disputes', '/admin/rates',
  '/dashboard/accounts', '/dashboard/cards', '/dashboard/wallets',
  '/dashboard/deposits', '/dashboard/transfers', '/dashboard/transactions',
  '/dashboard/beneficiaries', '/dashboard/rates', '/dashboard/exchange',
  '/dashboard/trading', '/dashboard/portfolio', '/dashboard/statements',
  '/dashboard/analytics', '/dashboard/goals', '/dashboard/bills',
  '/dashboard/payments', '/dashboard/rewards', '/dashboard/disputes',
  '/wallet', '/transfers', '/plaid',
] as const;

export function isOutsideSandboxKycScope(pathname: string): boolean {
  return pathname === '/dashboard' || EXCLUDED_ROUTES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
