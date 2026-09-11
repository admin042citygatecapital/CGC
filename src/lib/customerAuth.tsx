/**
 * Customer authentication context — completely isolated from admin auth.
 * The provider component lives in customerAuthProvider.tsx; this file holds
 * the context, the types and the hook. Uses a separate Secure, HttpOnly
 * cookie and separate API endpoints. Admin sessions and customer sessions
 * NEVER share state.
 */
import { createContext, useContext } from 'react';

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

export const Ctx = createContext<CustomerAuthCtx | null>(null);

export function useCustomerAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
}
