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
  logout: () => Promise<void>;
}

export interface AuthResult {
  ok?: boolean;
  error?: string;
  otpRequired?: boolean;
  challengeId?: string;
  expiresInSeconds?: number;
}

const Ctx = createContext<AdminAuthCtx | null>(null);
const LEGACY_TOKEN_KEY = 'cgc_admin_token';
let csrfToken: string | null = null;

function clearLegacyToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(LEGACY_TOKEN_KEY);
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
      const data = await response.json() as AuthResult & { admin?: AdminUser };
      if (!response.ok) return { error: data.error ?? 'Login failed' };
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
      const data = await response.json() as AuthResult & { admin?: AdminUser };
      if (!response.ok || !data.admin) return { error: data.error ?? 'Verification failed' };
      clearLegacyToken();
      setAdmin(data.admin);
      await refreshAdminCsrfToken();
      return { ok: true };
    } catch {
      return { error: 'Network error — please check your connection' };
    }
  }

  async function logout() {
    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: authHeaders(),
      });
    } catch {
      // Local sign-out still proceeds if the network is unavailable.
    }
    clearAuth();
  }

  return (
    <Ctx.Provider value={{ admin, loading, login, verifyOtp, logout }}>
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
