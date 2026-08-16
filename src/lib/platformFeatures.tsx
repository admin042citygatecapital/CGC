import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_PLATFORM_FEATURES,
  PLATFORM_FEATURE_KEYS,
  type PlatformFeatureKey,
  type PlatformFeatures,
} from '@/shared/platformFeatures';

const PlatformFeatureContext = createContext<PlatformFeatures>(DEFAULT_PLATFORM_FEATURES);

function normalizeFeatures(value: unknown): PlatformFeatures {
  if (!value || typeof value !== 'object') return DEFAULT_PLATFORM_FEATURES;
  const source = value as Record<string, unknown>;
  return PLATFORM_FEATURE_KEYS.reduce<PlatformFeatures>((features, key) => {
    features[key] = typeof source[key] === 'boolean' ? source[key] : DEFAULT_PLATFORM_FEATURES[key];
    return features;
  }, { ...DEFAULT_PLATFORM_FEATURES });
}

export function PlatformFeatureProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState(DEFAULT_PLATFORM_FEATURES);
  useEffect(() => {
    const controller = new AbortController();
    const customerSurface = window.location.pathname.startsWith('/dashboard') || window.location.pathname.startsWith('/onboarding');
    const publicEndpoint = '/api/platform/features';
    const endpoint = customerSurface ? '/api/users/features' : publicEndpoint;
    fetch(endpoint, { signal: controller.signal, credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('feature configuration unavailable')))
      .then(payload => setFeatures(normalizeFeatures(payload.features)))
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (!customerSurface) return;
        return fetch(publicEndpoint, { signal: controller.signal })
          .then(response => response.ok ? response.json() : Promise.reject(new Error('public feature configuration unavailable')))
          .then(payload => setFeatures(normalizeFeatures(payload.features)))
          .catch(fallbackError => {
            if (fallbackError instanceof DOMException && fallbackError.name === 'AbortError') return;
            // Keep safe defaults when both read-only configuration endpoints are unavailable.
          });
      });
    return () => controller.abort();
  }, []);
  const value = useMemo(() => features, [features]);
  return <PlatformFeatureContext.Provider value={value}>{children}</PlatformFeatureContext.Provider>;
}

export function usePlatformFeatures(): PlatformFeatures {
  return useContext(PlatformFeatureContext);
}

export function usePlatformFeature(feature: PlatformFeatureKey): boolean {
  return usePlatformFeatures()[feature];
}
