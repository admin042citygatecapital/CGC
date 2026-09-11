/**
 * Administrator authentication context.
 *
 * The provider component lives in adminAuthProvider.tsx; this file holds the
 * context, the types and the fetch/session helpers.
 *
 * The session credential exists only in the Secure, HttpOnly cookie. Browser
 * JavaScript receives an independent CSRF token but never the session token.
 */
import { createContext, useContext } from 'react';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar: string;
  permissions: string[];
}

interface AdminAuthCtx {
  admin: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  verifyOtp: (challengeId: string, otp: string, rememberDevice: boolean) => Promise<AuthResult>;
  resendOtp: (challengeId: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

export interface AuthResult {
  ok?: boolean;
  error?: string;
  otpRequired?: boolean;
  challengeId?: string;
  expiresInSeconds?: number;
  deliveryMode?: 'email' | 'local';
  locked?: boolean;
  expired?: boolean;
}

export const Ctx = createContext<AdminAuthCtx | null>(null);
let csrfToken: string | null = null;

/** Clears the in-memory CSRF token (called when the admin session is cleared). */
export function resetAdminCsrfToken() {
  csrfToken = null;
}

export async function refreshAdminCsrfToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/csrf', { credentials: 'same-origin' });
    if (!response.ok) return null;
    const data = await response.json() as { csrfToken?: string };
    csrfToken = data.csrfToken ?? null;
    return csrfToken;
  } catch {
    csrfToken = null;
    return null;
  }
}

function isAdminCsrfFailure(response: Response, body: unknown): boolean {
  if (response.status !== 403 || !body || typeof body !== 'object') return false;
  const error = 'error' in body ? (body as { error?: unknown }).error : undefined;
  return typeof error === 'string' && (
    error === 'CSRF token missing'
    || error === 'CSRF token invalid or expired'
  );
}

/**
 * Fetch an administrator API with the current double-submit CSRF token.
 *
 * Administrator sessions outlive CSRF cookies. A state-changing request that
 * fails specifically because its CSRF pair is missing or stale refreshes the
 * pair and is retried once. Ordinary 403 permission denials are never retried.
 */
export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const stateChanging = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  if (stateChanging && !csrfToken) await refreshAdminCsrfToken();

  const request = () => {
    const headers = new Headers(init.headers);
    if (stateChanging && csrfToken) headers.set('X-CSRF-Token', csrfToken);
    return fetch(input, {
      ...init,
      credentials: init.credentials ?? 'same-origin',
      headers,
    });
  };

  let response = await request();
  if (!stateChanging || response.status !== 403) return response;

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return response;
  }
  if (!isAdminCsrfFailure(response, body)) return response;

  const refreshed = await refreshAdminCsrfToken();
  if (!refreshed) return response;
  response = await request();
  return response;
}

/**
 * Revoke the cookie-backed administrator session. A CSRF token has a shorter
 * lifetime than the administrator session, so a stale token is refreshed once
 * before the operation is considered failed. The caller must not clear local
 * authentication state unless this returns true.
 */
export async function revokeAdminSession(): Promise<boolean> {
  try {
    const response = await adminFetch('/api/admin/auth/logout', { method: 'POST' });
    return response.ok;
  } catch {
    return false;
  }
}

export function useAdminAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}

/** Headers required for authenticated administrator writes. */
export function authHeaders(): Record<string, string> {
  return csrfToken ? { 'X-CSRF-Token': csrfToken } : {};
}
