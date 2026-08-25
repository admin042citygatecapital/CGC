/**
 * Administrator authentication context.
 *
 * The session credential exists only in the Secure, HttpOnly cookie. Browser
 * JavaScript receives an independent CSRF token but never the session token.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

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

const Ctx = createContext<AdminAuthCtx | null>(null);
const LEGACY_TOKEN_KEY = 'cgc_admin_token';
let csrfToken: string | null = null;

function clearLegacyToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(LEGACY_TOKEN_KEY);
}

async function readAuthResponse(response: Response): Promise<AuthResult & { admin?: AdminUser }> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) return {};
  try {
    return await response.json() as AuthResult & { admin?: AdminUser };
  } catch {
    return {};
  }
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

/**
 * Revoke the cookie-backed administrator session. A CSRF token has a shorter
 * lifetime than the administrator session, so a stale token is refreshed once
 * before the operation is considered failed. The caller must not clear local
 * authentication state unless this returns true.
 */
export async function revokeAdminSession(): Promise<boolean> {
  async function requestLogout(): Promise<Response> {
    return fetch('/api/admin/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: authHeaders(),
    });
  }

  try {
    let response = await requestLogout();
    if (response.status === 403) {
      const refreshed = await refreshAdminCsrfToken();
      if (!refreshed) return false;
      response = await requestLogout();
    }
    return response.ok;
  } catch {
    return false;
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(() => {
    clearLegacyToken();
    csrfToken = null;
    setAdmin(null);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    clearLegacyToken();
    refreshAdminCsrfToken()
      .then(() => fetch('/api/admin/auth/verify', { credentials: 'same-origin' }))
      .then(async response => {
        if (response.status === 401 || response.status === 403) {
          clearAuth();
          return;
        }
        if (!response.ok) return;
        const data = await response.json() as { admin?: AdminUser };
        if (data.admin) setAdmin(data.admin);
        else clearAuth();
      })
      .catch(() => {
        // A transient network failure must not manufacture an authenticated UI.
        setAdmin(null);
      })
      .finally(() => setLoading(false));
  }, [clearAuth]);

  async function login(email: string, password: string) {
    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await readAuthResponse(response);
      if (!response.ok) return { ...data, error: data.error ?? 'Authentication service unavailable' };
      if (data.otpRequired && data.challengeId) return data;
      if (!data.admin) return { error: data.error ?? 'Login failed' };

      clearLegacyToken();
      setAdmin(data.admin);
      await refreshAdminCsrfToken();
      return { ok: true };
    } catch {
      return { error: 'Network error — please check your connection' };
    }
  }

  async function verifyOtp(challengeId: string, otp: string, rememberDevice: boolean) {
    try {
      const response = await fetch('/api/admin/auth/otp/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, otp, rememberDevice }),
      });
      const data = await readAuthResponse(response);
      if (!response.ok || !data.admin) return { ...data, error: data.error ?? 'Verification failed' };
      clearLegacyToken();
      setAdmin(data.admin);
      await refreshAdminCsrfToken();
      return { ok: true };
    } catch {
      return { error: 'Network error — please check your connection' };
    }
  }

  async function resendOtp(challengeId: string) {
    try {
      const response = await fetch('/api/admin/auth/otp/resend', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId }),
      });
      const data = await readAuthResponse(response);
      if (!response.ok) return { ...data, error: data.error ?? 'Unable to request a new code' };
      if (!data.otpRequired || !data.challengeId) return { error: 'Unable to request a new code' };
      return data;
    } catch {
      return { error: 'Network error — please check your connection' };
    }
  }

  async function logout() {
    const revoked = await revokeAdminSession();
    if (!revoked) throw new Error('Unable to securely end the administrator session');
    clearAuth();
  }

  return (
    <Ctx.Provider value={{ admin, loading, login, verifyOtp, resendOtp, logout }}>
      {children}
    </Ctx.Provider>
  );
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
