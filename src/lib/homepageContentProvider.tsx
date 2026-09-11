/**
 * Homepage content provider, split out of homepageContentContext.tsx so that
 * file exports only the hook and types (react-refresh/only-export-components).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { home as bundledHomepage } from 'virtual:content';
import { HomepageContentContext } from './homepageContentContext';
import type { HomepageContent } from './homepageContentContext';

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