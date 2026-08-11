/**
 * Customer authentication context — completely isolated from admin auth.
 * Uses a separate Secure, HttpOnly cookie and separate API endpoints.
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
  amlStatus: string;
  amlRiskLevel: string;
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
  login:    (email: string, password: string, otp?: string) => Promise<{ ok?: boolean; error?: string; code?: string }>;
  logout:   () => void;
}

const Ctx = createContext<CustomerAuthCtx | null>(null);
const LEGACY_TOKEN_KEY = 'cgc_customer_token';
const SESSION_READY = 'cookie-session';

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  // `token` is retained as a non-secret readiness sentinel while older pages
  // migrate to a boolean session API. It is never an authentication credential.
  const [token,    setToken]    = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: verify existing customer session
  useEffect(() => {
    if (typeof window === 'undefined') { setLoading(false); return; }
    localStorage.removeItem(LEGACY_TOKEN_KEY);

    fetch('/api/users/session', {
      credentials: 'same-origin',
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
          setToken(SESSION_READY);
        } else {
          setToken(null);
        }
      })
      .catch(() => {
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string, otp?: string) {
    const res  = await fetch('/api/users/login', {
      method:  'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, otp }),
    });
    const data = await res.json();

    if (!res.ok) return { error: data.error ?? 'Login failed', code: data.code };

    if (typeof window !== 'undefined') localStorage.removeItem(LEGACY_TOKEN_KEY);
    setToken(SESSION_READY);
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
    // Invalidate the session server-side (fire-and-forget — don't block the UI)
    if (token) {
      fetch('/api/users/logout', {
        method:  'POST',
        credentials: 'same-origin',
      }).catch(() => { /* ignore network errors on logout */ });
    }
    if (typeof window !== 'undefined') localStorage.removeItem(LEGACY_TOKEN_KEY);
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
