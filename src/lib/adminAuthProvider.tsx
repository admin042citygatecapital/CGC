/**
 * Administrator authentication provider.
 * Split from adminAuth.tsx so that file exports only functions and types
 * (react-refresh/only-export-components). The session credential exists only
 * in the Secure, HttpOnly cookie. Browser JavaScript receives an independent
 * CSRF token but never the session token.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Ctx, refreshAdminCsrfToken, resetAdminCsrfToken, revokeAdminSession } from './adminAuth';
import type { AdminUser, AuthResult } from './adminAuth';

const LEGACY_TOKEN_KEY = 'cgc_admin_token';

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

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(() => {
    clearLegacyToken();
    resetAdminCsrfToken();
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