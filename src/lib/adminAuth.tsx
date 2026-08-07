/**
 * Admin authentication context — direct password-only login.
 *
 * Token storage (defence-in-depth):
 *  - Primary:  HttpOnly cookie `cgc_admin_sid` — XSS-safe, auto-sent on same-origin requests
 *  - Fallback: localStorage `cgc_admin_token` — for explicit Bearer headers in fetch calls
 *
 * Session verify is called once on mount. On 401 the stale token is cleared
 * immediately so the login page is shown without a redirect loop.
 */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

export interface AdminUser {
  id:     string;
  email:  string;
  name:   string;
  role:   string;
  avatar: string;
}

interface AdminAuthCtx {
  admin:   AdminUser | null;
  token:   string | null;
  loading: boolean;
  login:   (email: string, password: string) => Promise<{ ok?: boolean; error?: string }>;
  logout:  () => Promise<void>;
}

const Ctx = createContext<AdminAuthCtx | null>(null);
const TOKEN_KEY = 'cgc_admin_token';

function clearStoredToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin,   setAdmin]   = useState<AdminUser | null>(null);
  // Always initialise to null so server and client render the same initial
  // markup (fixes React hydration mismatch #418). The stored token is read
  // inside the verify useEffect, which only runs on the client after hydration.
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setAdmin(null);
  }, []);

  // On mount: verify existing session
  useEffect(() => {
    if (typeof window === 'undefined') { setLoading(false); return; }

    const storedToken = getStoredToken();

    fetch('/api/admin/auth/verify', {
      credentials: 'same-origin',
      headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
    })
      .then(async r => {
        if (r.status === 401 || r.status === 403) {
          // Session expired or invalid — clear immediately, no retry
          clearAuth();
          return;
        }
        if (!r.ok) {
          // Server error — don't clear token, might be transient
          return;
        }
        const data = await r.json();
        if (data?.admin) {
          setAdmin(data.admin);
          // Sync token state if it was set via cookie only
          if (!storedToken && data.token) {
            localStorage.setItem(TOKEN_KEY, data.token);
            setToken(data.token);
          }
        } else {
          clearAuth();
        }
      })
      .catch(() => {
        // Network error — keep token, show login if needed
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    try {
      const res  = await fetch('/api/admin/auth/login', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) return { error: data.error ?? 'Login failed' };

      const newToken = data.token as string | undefined;
      if (newToken && typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, newToken);
      }
      setToken(newToken ?? null);
      setAdmin(data.admin);
      return { ok: true };
    } catch {
      return { error: 'Network error — please check your connection' };
    }
  }

  async function logout() {
    const currentToken = getStoredToken();
    try {
      await fetch('/api/admin/auth/logout', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
      });
    } catch { /* ignore network errors on logout */ }

    clearAuth();
  }

  return (
    <Ctx.Provider value={{ admin, token, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}

/** Returns { Authorization: 'Bearer <token>' } or {} if no token */
export function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}
