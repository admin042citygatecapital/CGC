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
    fetch('/api/platform/features', { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('feature configuration unavailable')))
      .then(payload => setFeatures(normalizeFeatures(payload.features)))
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // Keep safe defaults when the read-only configuration endpoint is unavailable.
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
