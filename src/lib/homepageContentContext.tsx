import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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

const HomepageContentContext = createContext<HomepageContent>(bundledHomepage);

export function HomepageContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<HomepageContent>(bundledHomepage);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/cms/homepage', { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        if (payload?.content && typeof payload.content === 'object') setContent(payload.content as HomepageContent);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return <HomepageContentContext.Provider value={content}>{children}</HomepageContentContext.Provider>;
}

export function useHomepageContent(): HomepageContent {
  return useContext(HomepageContentContext);
}
