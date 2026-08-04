import { useEffect } from 'react';

declare global {
  interface Window {
    _smartsupp?: { key: string };
    smartsupp?: ((...args: unknown[]) => void) & { _: unknown[] };
  }
}

/**
 * Loads the Smartsupp live-chat widget once, mounted for the app's whole
 * lifetime (see LayoutWrapper in App.tsx). The widget key comes from
 * /api/config/smartsupp-key (backed by smartsuppStore.ts, env SMARTSUPP_KEY
 * as fallback) rather than being hardcoded here, so it stays admin-editable
 * without a redeploy.
 */
export default function SmartsuppWidget() {
  useEffect(() => {
    let cancelled = false;

    fetch('/api/config/smartsupp-key')
      .then(res => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; key?: string | null; enabled?: boolean } | null) => {
        if (cancelled || !data?.ok || !data.key || !data.enabled) return;
        if (window.smartsupp) return; // already loaded

        window._smartsupp = { key: data.key };
        const s = document.getElementsByTagName('script')[0];
        const c = document.createElement('script');
        const box: { _: unknown[] } & ((...args: unknown[]) => void) = Object.assign(
          (...args: unknown[]) => { box._.push(args); },
          { _: [] as unknown[] }
        );
        window.smartsupp = box;
        c.type = 'text/javascript';
        c.charset = 'utf-8';
        c.async = true;
        c.src = 'https://www.smartsuppchat.com/loader.js?';
        s.parentNode?.insertBefore(c, s);
      })
      .catch(() => { /* chat widget is non-critical — fail silently */ });

    return () => { cancelled = true; };
  }, []);

  return null;
}
