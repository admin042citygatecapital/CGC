/**
 * Customer authentication context — completely isolated from admin auth.
 * Uses a separate cookie key and separate API endpoints.
 * Admin sessions and customer sessions NEVER share state.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface CustomerUser {
  id:        string;
  name:      string;
  email:     string;
  status:    string;
  kycStatus: string;
  balance:   number;
}

interface CustomerAuthCtx {
  customer: CustomerUser | null;
  token:    string | null;
  loading:  boolean;
  login:    (email: string, password: string) => Promise<{ ok?: boolean; error?: string; code?: string }>;
  logout:   () => void;
}

const Ctx = createContext<CustomerAuthCtx | null>(null);
const TOKEN_KEY = 'cgc_customer_token'; // Separate key from admin's cgc_admin_token

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [token,    setToken]    = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  });
  const [loading, setLoading] = useState(true);

  // On mount: verify existing customer session
  useEffect(() => {
    if (typeof window === 'undefined') { setLoading(false); return; }
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) { setLoading(false); return; }

    fetch('/api/users/session', {
      credentials: 'same-origin',
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          setCustomer({ ...data.user, balance: data.user.balance ?? 0 });
          setToken(stored);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res  = await fetch('/api/users/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) return { error: data.error ?? 'Login failed', code: data.code };

    if (data.token && typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, data.token);
    }
    setToken(data.token ?? null);
    setCustomer(data.user ? { ...data.user, balance: data.user.balance ?? 0 } : null);
    return { ok: true };
  }

  function logout() {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (stored) {
      // Fire-and-forget — invalidate server-side session token
      fetch('/api/users/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${stored}` },
      }).catch(() => { /* ignore network errors on logout */ });
      localStorage.removeItem(TOKEN_KEY);
    }
    setToken(null);
    setCustomer(null);
  }

  return (
    <Ctx.Provider value={{ customer, token, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

const NULL_AUTH: CustomerAuthCtx = {
  customer: null,
  token:    null,
  loading:  false,
  login:    async () => ({ error: 'No CustomerAuthProvider' }),
  logout:   () => {},
};


export function useCustomerAuth(): CustomerAuthCtx {
  const ctx = useContext(Ctx);
  // Return a safe no-op default for public pages rendered outside CustomerAuthProvider
  // (e.g. /support, /digital-banking call this hook but are public routes).
  // Pages that need auth are guarded by <CustomerOnly> in routes.tsx.
  return ctx ?? NULL_AUTH;
}
