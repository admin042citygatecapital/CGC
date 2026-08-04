/**
 * useABTest — lightweight client-side A/B testing hook.
 *
 * Design principles:
 * - Variant is assigned once per experiment per browser (localStorage).
 * - Assignment is deterministic: Math.random() seeded by sessionId + experimentId
 *   so the same user always gets the same variant within a session.
 * - Impression is fired once per page load (deduplicated by ref).
 * - Conversion is fired manually via `trackABConversion()`.
 * - No PII stored — only random session IDs and experiment names.
 *
 * Usage:
 *   const { variant } = useABTest('hero-cta-copy', ['control', 'urgency', 'benefit']);
 *   // variant === 'control' | 'urgency' | 'benefit'
 */

import { useEffect, useRef, useMemo, useState } from 'react';

const STORAGE_KEY_PREFIX = 'cgc_ab_';

// ── Variant assignment ────────────────────────────────────────────────────────

/**
 * Returns a stable variant for the given experiment.
 * Persists to localStorage so the user always sees the same variant.
 */
export function getVariant<T extends string>(experimentId: string, variants: T[]): T {
  if (variants.length === 0) throw new Error('variants must be non-empty');
  const key = `${STORAGE_KEY_PREFIX}${experimentId}`;
  try {
    const stored = localStorage.getItem(key);
    if (stored && variants.includes(stored as T)) return stored as T;
    // Assign randomly and persist
    const assigned = variants[Math.floor(Math.random() * variants.length)];
    localStorage.setItem(key, assigned);
    return assigned;
  } catch {
    // SSR or private-browsing fallback — always return first variant
    return variants[0];
  }
}

/**
 * Clears the stored variant for an experiment (useful for testing / resetting).
 */
export function resetVariant(experimentId: string): void {
  try { localStorage.removeItem(`${STORAGE_KEY_PREFIX}${experimentId}`); } catch { /* noop */ }
}

// ── Event tracking ────────────────────────────────────────────────────────────

function getSessionId(): string {
  try {
    const key = 'cgc_sid';
    let sid = sessionStorage.getItem(key);
    if (!sid) {
      sid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(key, sid);
    }
    return sid;
  } catch { return 'unknown'; }
}

async function sendABEvent(
  eventType: 'ab_impression' | 'ab_conversion',
  experimentId: string,
  variant: string,
  page: string,
  meta?: Record<string, string | number | boolean>
): Promise<void> {
  try {
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: eventType,
        page,
        sessionId: getSessionId(),
        meta: { experiment: experimentId, variant, ...meta },
      }),
      keepalive: true,
    });
  } catch { /* never throw */ }
}

/**
 * Call when the user converts on an A/B-tested element.
 *
 * @example
 * trackABConversion('hero-cta-copy', variant, '/');
 */
export function trackABConversion(
  experimentId: string,
  variant: string,
  page: string,
  meta?: Record<string, string | number | boolean>
): void {
  void sendABEvent('ab_conversion', experimentId, variant, page, meta);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface ABTestResult<T extends string> {
  /** The variant assigned to this user for this experiment */
  variant: T;
  /** Fire a conversion event for this experiment */
  convert: (meta?: Record<string, string | number | boolean>) => void;
  /** True when the user is in the control group */
  isControl: boolean;
}

/**
 * Hook that assigns a variant, fires an impression on mount, and exposes a
 * `convert()` helper.
 *
 * @param experimentId  Unique stable name for the experiment, e.g. 'hero-cta-copy'
 * @param variants      Array of variant names; first is treated as control
 * @param page          Current page path (pass `useLocation().pathname`)
 */
export function useABTest<T extends string>(
  experimentId: string,
  variants: readonly T[],
  page: string
): ABTestResult<T> {
  const variantList = variants as T[];

  // Always start with variants[0] so SSR and the initial client render match
  // (avoids React hydration mismatch). useEffect then resolves the real stored
  // variant from localStorage after hydration is complete.
  const [variant, setVariant] = useState<T>(variantList[0]);
  const impressionFired = useRef(false);

  useEffect(() => {
    const resolved = getVariant(experimentId, variantList);
    setVariant(resolved);
  }, [experimentId, variantList.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (impressionFired.current) return;
    impressionFired.current = true;
    void sendABEvent('ab_impression', experimentId, variant, page);
  }, [experimentId, variant, page]);

  const convert = useMemo(
    () => (meta?: Record<string, string | number | boolean>) =>
      trackABConversion(experimentId, variant, page, meta),
    [experimentId, variant, page]
  );

  return { variant, convert, isControl: variant === variantList[0] };
}
