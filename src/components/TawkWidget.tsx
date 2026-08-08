/**
 * TawkWidget — City Gate Capital live support.
 *
 * Tawk property and widget identifiers are public embed identifiers. They can
 * be overridden at build time for non-production environments.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PROPERTY_ID = (import.meta.env.VITE_TAWK_PROPERTY_ID || '6a773b21198d971d45c5ff66').trim();
const WIDGET_ID = (import.meta.env.VITE_TAWK_WIDGET_ID || '1jvgrtvnn').trim();
const EMBED_ID_PATTERN = /^[a-z0-9]+$/i;
const SCRIPT_ID = 'city-gate-tawk-widget';

declare global {
  interface Window {
    Tawk_API?: {
      onLoad?: () => void;
      hideWidget?: () => void;
      showWidget?: () => void;
    };
    Tawk_LoadStart?: Date;
    __cityGateTawkLoaded?: boolean;
  }
}

function shouldHideWidget(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function setWidgetVisibility(pathname: string): void {
  try {
    if (shouldHideWidget(pathname)) {
      window.Tawk_API?.hideWidget?.();
    } else {
      window.Tawk_API?.showWidget?.();
    }
  } catch (error) {
    console.warn('[Tawk] Unable to update widget visibility:', error);
  }
}

function injectWidget(pathname: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!EMBED_ID_PATTERN.test(PROPERTY_ID) || !EMBED_ID_PATTERN.test(WIDGET_ID)) return;

  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_API.onLoad = () => setWidgetVisibility(window.location.pathname);

  if (window.__cityGateTawkLoaded || document.getElementById(SCRIPT_ID)) {
    setWidgetVisibility(pathname);
    return;
  }

  window.__cityGateTawkLoaded = true;
  window.Tawk_LoadStart = new Date();

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.charset = 'UTF-8';
  script.src = `https://embed.tawk.to/${PROPERTY_ID}/${WIDGET_ID}`;
  script.setAttribute('crossorigin', '*');
  script.onerror = () => {
    window.__cityGateTawkLoaded = false;
    script.remove();
    console.warn('[Tawk] Live support could not be loaded. The site will continue normally.');
  };

  document.head.appendChild(script);
}

export default function TawkWidget() {
  const location = useLocation();

  useEffect(() => {
    injectWidget(location.pathname);
  }, []);

  useEffect(() => {
    setWidgetVisibility(location.pathname);
  }, [location.pathname]);

  return null;
}
