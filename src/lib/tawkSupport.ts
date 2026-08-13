export type TawkAvailability = 'online' | 'away' | 'offline';

export function shouldOfferBankingSupport(pathname: string): boolean {
  return pathname !== '/admin'
    && !pathname.startsWith('/admin/')
    && pathname !== '/sponsor-review';
}

export function getSupportSection(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'home';
  if (pathname === '/login' || pathname === '/register' || pathname.includes('password')) return 'authentication';
  if (pathname.startsWith('/dashboard/trading')) return 'trading';
  if (pathname.startsWith('/dashboard')) return 'customer_dashboard';
  if (pathname.startsWith('/demo/accounts') || pathname.startsWith('/accounts')) return 'accounts_demo';
  if (pathname.startsWith('/transfers')) return 'transfers';
  if (pathname.startsWith('/demo/support') || pathname.startsWith('/support')) return 'demo_support';
  if (pathname.startsWith('/contact')) return 'contact';
  return 'public_website';
}

/**
 * Keep third-party context intentionally coarse. These attributes help route a
 * conversation without disclosing identity, account, balance, KYC, or AML data.
 */
export function getTawkContextAttributes(
  pathname: string,
  authenticated: boolean,
): Record<string, string> {
  return {
    support_channel: 'citygate_web',
    journey: getSupportSection(pathname),
    session_type: authenticated ? 'authenticated' : 'guest',
  };
}
