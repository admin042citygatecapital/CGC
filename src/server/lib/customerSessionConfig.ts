import type { CookieOptions, Response } from 'express';

function positiveDuration(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const CUSTOMER_SESSION_INACTIVITY_MS =
  positiveDuration(process.env.SESSION_CUSTOMER_TIMEOUT_MINUTES, 60) * 60_000;
export const CUSTOMER_SESSION_ABSOLUTE_MS =
  positiveDuration(process.env.SESSION_CUSTOMER_MAX_HOURS, 8) * 3_600_000;

export const CUSTOMER_SESSION_COOKIE = 'cgc_customer_sid';
export const CUSTOMER_SESSION_COOKIE_PATH = '/api/users';

export function customerSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CUSTOMER_SESSION_ABSOLUTE_MS,
    path: CUSTOMER_SESSION_COOKIE_PATH,
  };
}

export function clearCustomerSessionCookie(res: Response): void {
  res.clearCookie(CUSTOMER_SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: CUSTOMER_SESSION_COOKIE_PATH,
  });
}
