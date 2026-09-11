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
  totpEnabled: boolean;
  accessMode: 'full' | 'onboarding';
}

interface CustomerAuthCtx {
  customer: CustomerUser | null;
  token:    string | null;
  loading:  boolean;
  login:    (email: string, password: string, otp?: string) => Promise<{ ok?: boolean; error?: string; code?: string; nextPath?: string }>;
  logout:   () => void;
  /** Re-fetches the session and updates the customer state (e.g. after 2FA changes). */
  refresh:  () => Promise<void>;
}

const Ctx = createContext<CustomerAuthCtx | null>(null);
const LEGACY_TOKEN_KEY = 'cgc_customer_token';
const SESSION_READY = 'cookie-session';

/** Normalizes a session payload into the shared CustomerUser shape. */
function mapCustomerUser(user: Record<string, unknown> | undefined, accessMode: unknown): CustomerUser | null {
  if (!user) return null;
  const u = user as Record<string, unknown> & { accessMode?: string };
  return {
    ...u,
    accessMode: (accessMode ?? u.accessMode ?? 'full') as 'full' | 'onboarding',
    phone:       (u.phone       as string) ?? '',
    country:     (u.country     as string) ?? '',
    balance:     (u.balance     as number) ?? 0,
    avatarUrl:   (u.avatarUrl   as string) ?? '',
    walletBtc:   (u.walletBtc   as string) ?? '',
    walletEth:   (u.walletEth   as string) ?? '',
    walletUsdt:  (u.walletUsdt  as string) ?? '',
    walletSol:   (u.walletSol   as string) ?? '',
    dateOfBirth: (u.dateOfBirth as string) ?? '',
    address:     (u.address     as string) ?? '',
    city:        (u.city        as string) ?? '',
    postalCode:  (u.postalCode  as string) ?? '',
    idType:      (u.idType      as string) ?? '',
    idNumber:    (u.idNumber    as string) ?? '',
    kycSubmittedAt: (u.kycSubmittedAt as string) ?? '',
  } as CustomerUser;
}

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
          setCustomer(mapCustomerUser(data.user, data.accessMode));
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
    setCustomer(mapCustomerUser(data.user, data.accessMode));
    return { ok: true, nextPath: data.nextPath ?? (data.accessMode === 'onboarding' ? '/kyc' : '/dashboard') };
  }

  // Re-syncs the customer state from the session endpoint. Used after
  // security-relevant changes (2FA enable/disable) so dependent pages read
  // the updated flags without a full reload.
  async function refresh() {
    try {
      const res = await fetch('/api/users/session', { credentials: 'same-origin' });
      const data = res.ok ? await res.json().catch(() => null) : null;
      if (data?.user) {
        setCustomer(mapCustomerUser(data.user, data.accessMode));
        setToken(SESSION_READY);
      } else {
        setToken(null);
        setCustomer(null);
      }
    } catch {
      // Network error: keep the current in-memory state.
    }
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
    <Ctx.Provider value={{ customer, token, loading, login, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
}
