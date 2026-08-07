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
  phone:     string;
  country:   string;
  status:    string;
  kycStatus: string;
  balance:   number;
  avatarUrl:  string;
  walletBtc:  string;
  walletEth:  string;
  walletUsdt: string;
  walletSol:  string;
  dateOfBirth: string;
  address:     string;
  city:        string;
  postalCode:  string;
  idType:      string;
  idNumber:    string;
  kycSubmittedAt: string;
  primaryCurrency: string;
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
  // Always initialise to null so server and client render the same initial
  // markup (fixes React hydration mismatch). The stored token is read inside
  // the verify useEffect, which only runs on the client after hydration.
  const [token,    setToken]    = useState<string | null>(null);
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
          setCustomer({
            ...data.user,
            phone:       data.user.phone       ?? '',
            country:     data.user.country     ?? '',
            balance:     data.user.balance     ?? 0,
            avatarUrl:   data.user.avatarUrl   ?? '',
            walletBtc:   data.user.walletBtc   ?? '',
            walletEth:   data.user.walletEth   ?? '',
            walletUsdt:  data.user.walletUsdt  ?? '',
            walletSol:   data.user.walletSol   ?? '',
            dateOfBirth: data.user.dateOfBirth ?? '',
            address:     data.user.address     ?? '',
            city:        data.user.city        ?? '',
            postalCode:  data.user.postalCode  ?? '',
            idType:      data.user.idType      ?? '',
            idNumber:    data.user.idNumber    ?? '',
            kycSubmittedAt: data.user.kycSubmittedAt ?? '',
          });
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
    setCustomer(data.user ? {
      ...data.user,
      phone:       data.user.phone       ?? '',
      country:     data.user.country     ?? '',
      balance:     data.user.balance     ?? 0,
      avatarUrl:   data.user.avatarUrl   ?? '',
      walletBtc:   data.user.walletBtc   ?? '',
      walletEth:   data.user.walletEth   ?? '',
      walletUsdt:  data.user.walletUsdt  ?? '',
      walletSol:   data.user.walletSol   ?? '',
      dateOfBirth: data.user.dateOfBirth ?? '',
      address:     data.user.address     ?? '',
      city:        data.user.city        ?? '',
      postalCode:  data.user.postalCode  ?? '',
      idType:      data.user.idType      ?? '',
      idNumber:    data.user.idNumber    ?? '',
      kycSubmittedAt: data.user.kycSubmittedAt ?? '',
    } : null);
    return { ok: true };
  }

  function logout() {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    // Invalidate the session server-side (fire-and-forget — don't block the UI)
    if (stored) {
      fetch('/api/users/logout', {
        method:  'POST',
        headers: { Authorization: `Bearer ${stored}` },
      }).catch(() => { /* ignore network errors on logout */ });
    }
    if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setCustomer(null);
  }

  return (
    <Ctx.Provider value={{ customer, token, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
}
