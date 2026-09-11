/**
 * Platform feature flags context.
 * The provider component lives in platformFeatureProvider.tsx; this file
 * holds the context and the hooks.
 */
import { createContext, useContext } from 'react';
import {
  DEFAULT_PLATFORM_FEATURES,
  type PlatformFeatureKey,
  type PlatformFeatures,
} from '@/shared/platformFeatures';

export const PlatformFeatureContext = createContext<PlatformFeatures>(DEFAULT_PLATFORM_FEATURES);

export function usePlatformFeatures(): PlatformFeatures {
  return useContext(PlatformFeatureContext);
}

export function usePlatformFeature(feature: PlatformFeatureKey): boolean {
  return usePlatformFeatures()[feature];
}
