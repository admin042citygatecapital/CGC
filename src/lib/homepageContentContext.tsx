/**
 * Homepage content context.
 * The provider component lives in homepageContentProvider.tsx; this file
 * holds the context, the type and the hook.
 */
import { createContext, useContext } from 'react';
import { home as bundledHomepage } from 'virtual:content';

export type HomepageContent = typeof bundledHomepage & {
  _visibility?: {
    showStats: boolean;
    showTestimonials: boolean;
    showPartners: boolean;
    showNewsSection: boolean;
  };
  _announcement?: {
    enabled: boolean;
    text: string;
    type: 'info' | 'warning' | 'success' | 'maintenance';
  };
};

export const HomepageContentContext = createContext<HomepageContent>(bundledHomepage);

export function useHomepageContent(): HomepageContent {
  return useContext(HomepageContentContext);
}
