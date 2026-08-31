import type { NextFunction, Request, Response } from 'express';
import type { UserRecord } from './userStore.js';

export type CustomerAccessMode = 'full' | 'onboarding' | 'denied';

export function getCustomerAccessMode(
  user: Pick<UserRecord, 'emailVerified' | 'status'>,
): CustomerAccessMode {
  if (!user.emailVerified) return 'denied';
  if (user.status === 'active') return 'full';
  if (user.status === 'pending_kyc' || user.status === 'pending_approval') return 'onboarding';
  return 'denied';
}

export function getCustomerLandingPath(
  user: Pick<UserRecord, 'emailVerified' | 'status'>,
): '/dashboard' | '/kyc' | '/login' {
  const mode = getCustomerAccessMode(user);
  return mode === 'full' ? '/dashboard' : mode === 'onboarding' ? '/kyc' : '/login';
}

const ONBOARDING_ROUTES = new Set([
  'GET /session',
  'POST /logout',
  'GET /onboarding',
  'PUT /onboarding/profile',
  'POST /onboarding/documents',
  'POST /onboarding/evidence',
  'POST /onboarding/submit',
  'GET /support',
  'POST /support',
]);

export function isOnboardingRouteAllowed(method: string, path: string): boolean {
  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return ONBOARDING_ROUTES.has(`${method.toUpperCase()} ${normalized}`);
}

/**
 * Enforce the registration lifecycle after the cookie has been authenticated.
 * Pending customers can inspect and complete onboarding, but cannot reach any
 * financial, device, notification, or dashboard API. The support and profile
 * surface above is deliberately restricted to onboarding needs.
 */
export function requireCustomerLifecycleAccess(req: Request, res: Response, next: NextFunction): void {
  const user = req.customerUser;
  // Public authentication endpoints have no attached principal and continue to
  // their own handlers. Authenticated endpoints are handled below.
  if (!user) return next();

  const mode = getCustomerAccessMode(user);
  req.customerAccessMode = mode;
  if (mode === 'full') return next();
  if (mode === 'onboarding' && isOnboardingRouteAllowed(req.method, req.path)) return next();

  const code = mode === 'onboarding' ? 'ONBOARDING_ONLY' : 'ACCOUNT_ACCESS_DENIED';
  res.status(403).json({
    error: mode === 'onboarding'
      ? 'Complete the registration and compliance review before accessing the customer dashboard.'
      : 'This account cannot access customer services.',
    code,
    nextPath: mode === 'onboarding' ? '/kyc' : '/login',
  });
}
