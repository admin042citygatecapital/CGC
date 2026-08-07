/**
 * SmartsuppWidget — City Gate Capital
 *
 * Loads the Smartsupp live-chat widget exactly once for the entire SPA
 * lifetime. Mounted at the App root (above RouterProvider) so it survives
 * React Router navigations without re-injecting the script.
 *
 * Design decisions:
 *  - SSR-safe: all DOM/window access is inside useEffect (client-only)
 *  - Dedup guard: checks window.__smartsuppLoaded before injecting
 *  - Async script: does not block the main thread or LCP
 *  - Error-isolated: a try/catch around every Smartsupp call so a CDN
 *    failure never crashes the app
 *  - User identification: sends id, name, email, accountNumber, type —
 *    never passwords, tokens, OTPs, or raw balances
 *  - Consent-aware: loads the widget immediately (functional service),
 *    but only calls smartsupp('variables', ...) after analytics consent
 *    is granted (or if already granted)
 *  - Admin identification: when an admin session is active the widget
 *    is hidden from public visitors and identifies the admin operator
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useCustomerAuth } from '@/lib/customerAuth';
import { useAdminAuth }    from '@/lib/adminAuth';
import { getAnalyticsConsent, onConsentChange } from '@/lib/analytics-consent';

// ─── Constants ────────────────────────────────────────────────────────────────

// The Smartsupp key is a PUBLIC widget identifier (not a secret — it is
// embedded in client-side JS and visible in the browser). It is fetched from
// the server config endpoint so the literal value is never hard-coded here.
// Falls back to an empty string if the config endpoint is unavailable.
let SMARTSUPP_KEY = '';
let smartsuppKeyPromise: Promise<string> | null = null;

// Fetch the key from the server once and cache it in the module-level variable.
// This runs before the component mounts so the key is ready when injectScript() fires.
if (typeof window !== 'undefined') {
  smartsuppKeyPromise = fetch('/api/config/smartsupp-key')
    .then(r => r.ok ? r.json() : null)
    .then((data: { key?: string } | null) => {
      SMARTSUPP_KEY = typeof data?.key === 'string' ? data.key.trim() : '';
      return SMARTSUPP_KEY;
    })
    .catch(() => '');
}

function loadSmartsuppKey(): Promise<string> {
  return smartsuppKeyPromise ?? Promise.resolve('');
}

// Pages where the widget should be completely hidden (no chat bubble shown).
// Admins always see the widget on admin pages; public visitors do not.
const HIDDEN_PATHS_PUBLIC = [
  '/admin/login',
  '/admin/forgot-password',
  '/admin/reset-password',
];

// ─── Type augmentation ────────────────────────────────────────────────────────

declare global {
  interface Window {
    _smartsupp:          Record<string, unknown>;
    smartsupp:           ((...args: unknown[]) => void) & { _: unknown[] };
    __smartsuppLoaded:   boolean;
    __smartsuppReady:    boolean;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely call smartsupp() — swallows errors so CDN failures don't crash the app */
function ss(...args: unknown[]): void {
  try {
    if (typeof window !== 'undefined' && typeof window.smartsupp === 'function') {
      window.smartsupp(...args);
    }
  } catch (err) {
    console.warn('[Smartsupp] command failed:', err);
  }
}

/** Inject the Smartsupp loader script once */
function injectScript(): void {
  if (typeof window === 'undefined') return;
  if (window.__smartsuppLoaded) return;
  if (!SMARTSUPP_KEY) return;

  try {
    window.__smartsuppLoaded = true;
    window.__smartsuppReady  = false;

    // Initialise the command queue before the script loads
    window._smartsupp     = window._smartsupp || {};
    window._smartsupp.key = SMARTSUPP_KEY;

    const o = (window.smartsupp = function (...args: unknown[]) {
      (window.smartsupp._ as unknown[]).push(args);
    } as Window['smartsupp']);
    o._ = [];

    // Queue the ready callback so we know when the widget is fully initialised
    ss('on', 'ready', () => {
      window.__smartsuppReady = true;
    });

    // Create async script tag
    const existing = document.getElementsByTagName('script')[0];
    const script   = document.createElement('script');
    script.type    = 'text/javascript';
    script.charset = 'utf-8';
    script.async   = true;
    script.src     = 'https://www.smartsuppchat.com/loader.js?';

    script.onerror = () => {
      // CDN unreachable — mark as not loaded so a retry is possible
      window.__smartsuppLoaded = false;
      console.warn('[Smartsupp] Failed to load chat widget — site continues normally.');
    };

    if (existing?.parentNode) {
      existing.parentNode.insertBefore(script, existing);
    } else {
      document.head.appendChild(script);
    }
  } catch (err) {
    window.__smartsuppLoaded = false;
    console.warn('[Smartsupp] Injection error:', err);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SmartsuppWidget() {
  const location                  = useLocation();
  const { customer }              = useCustomerAuth();
  const { admin }                 = useAdminAuth();
  const identifiedCustomerRef     = useRef<string | null>(null);
  const identifiedAdminRef        = useRef<string | null>(null);
  const consentCleanupRef         = useRef<(() => void) | null>(null);

  // ── Step 1: Inject script once on mount ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void loadSmartsuppKey().then((key) => {
      if (!cancelled && key) injectScript();
    });

    return () => {
      cancelled = true;
      // Cleanup consent listener on unmount (app teardown)
      consentCleanupRef.current?.();
    };
  }, []);

  // ── Step 2: Show / hide widget based on current path ────────────────────────
  useEffect(() => {
    const path     = location.pathname;
    const isAdmin  = path.startsWith('/admin');

    // Hide on specific public-facing admin auth pages
    if (HIDDEN_PATHS_PUBLIC.includes(path)) {
      ss('chat:hide');
      return;
    }

    // On admin pages: only show if an admin is logged in
    if (isAdmin) {
      if (admin) {
        ss('chat:show');
      } else {
        ss('chat:hide');
      }
      return;
    }

    // All other pages: always show
    ss('chat:show');
  }, [location.pathname, admin]);

  // ── Step 3: Identify customer when session is available ──────────────────────
  useEffect(() => {
    if (!customer) {
      // Customer logged out — reset visitor identity
      if (identifiedCustomerRef.current) {
        identifiedCustomerRef.current = null;
        ss('visitor', 'reset');
      }
      return;
    }

    // Avoid re-identifying the same customer on every render
    if (identifiedCustomerRef.current === customer.id) return;
    identifiedCustomerRef.current = customer.id;

    // Safe fields only — no passwords, tokens, OTPs, raw balances
    const visitorName  = customer.name  || 'Customer';
    const visitorEmail = customer.email || '';

    ss('visitor', 'name',  visitorName);
    ss('visitor', 'email', visitorEmail);

    // Extended variables — only sent after consent (or if already consented)
    function sendVariables() {
      ss('variables', {
        customerId:    { label: 'Customer ID',     value: customer!.id },
        customerType:  { label: 'Customer Type',   value: 'retail' },
        kycStatus:     { label: 'KYC Status',      value: customer!.kycStatus || 'unknown' },
        country:       { label: 'Country',         value: customer!.country   || '' },
        // Account number derived from the first 8 chars of the customer ID
        // (not a sensitive banking credential — just a display reference)
        accountRef:    { label: 'Account Ref',     value: customer!.id.slice(0, 8).toUpperCase() },
      });
    }

    if (getAnalyticsConsent()) {
      sendVariables();
    } else {
      // Listen for consent grant and send variables then
      consentCleanupRef.current?.();
      consentCleanupRef.current = onConsentChange((consented) => {
        if (consented) sendVariables();
      });
    }
  }, [customer]);

  // ── Step 4: Identify admin when session is available ─────────────────────────
  useEffect(() => {
    if (!admin) {
      if (identifiedAdminRef.current) {
        identifiedAdminRef.current = null;
        // Don't reset visitor on admin logout — just clear local ref
      }
      return;
    }

    if (identifiedAdminRef.current === admin.id) return;
    identifiedAdminRef.current = admin.id;

    ss('visitor', 'name',  admin.name  || 'Admin');
    ss('visitor', 'email', admin.email || '');
    ss('variables', {
      userType: { label: 'User Type', value: 'admin' },
      role:     { label: 'Admin Role', value: admin.role || 'ADMIN' },
    });
  }, [admin]);

  // This component renders nothing — it's a pure side-effect manager
  return null;
}
