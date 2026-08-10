import { useEffect,useState } from 'react';

import { Button } from '@/components/ui/button';
import { ANALYTICS_CONSENT_KEY, clearAnalyticsStorage, getStoredAnalyticsConsent, hasBrowserPrivacyOptOut } from '@/lib/analytics-consent';

const BANNER_RESET_KEY = 'airo-banner-reset';

declare global {
  interface Window {
    revokeAnalyticsConsent?: () => void;
  }
}

/**
 * Cookie banner component for first-party analytics consent.
 *
 * The application records only consented, data-minimised events. No third-party
 * analytics script is loaded by this component.
 */
export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const isEmbedded: boolean = typeof window !== 'undefined' && window.parent !== window;
  const [hideForBuilderPreview, setHideForBuilderPreview] = useState<boolean>(
    () => {
      if (!isEmbedded) return false;
      try {
        return sessionStorage.getItem(BANNER_RESET_KEY) !== 'true';
      } catch (e) {
        console.warn('CookieBanner: sessionStorage unavailable, banner state will not persist across remounts:', e instanceof Error ? e.message : String(e));
        return true;
      }
    }
  );

  useEffect(function checkConsent() {
    if (typeof window === 'undefined') return;

    if (hasBrowserPrivacyOptOut()) {
      setShowBanner(false);
      setIsLoaded(true);
      return;
    }

    const consent = getStoredAnalyticsConsent();
    if (!consent) {
      setShowBanner(true);
      setIsLoaded(true);
      return;
    }

    setIsLoaded(true);
  }, []);

  function saveConsent(analytics: boolean) {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify({ analytics, timestamp: Date.now() }));
    if (!analytics) {
      clearAnalyticsStorage();
      localStorage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify({ analytics: false, timestamp: Date.now() }));
    }
    window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: { consented: analytics } }));
    setShowBanner(false);
  }

  function revokeConsent() {
    if (typeof window === 'undefined') return;
    clearAnalyticsStorage();
    window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: { consented: false } }));
    setShowBanner(true);
  }

  useEffect(function exposeRevokeFunction() {
    if (typeof window === 'undefined') return;
    window.revokeAnalyticsConsent = revokeConsent;
    return () => { delete window.revokeAnalyticsConsent; };
  }, []);

  useEffect(function listenForBuilderBuildComplete() {
    if (typeof window === 'undefined' || window.parent === window) return;

    function handleMessage(event: MessageEvent): void {
      if (event.source !== window.parent) return;
      if (event.data?.type === 'INITIAL_BUILD_COMPLETE') {
        setHideForBuilderPreview(true);
        try {
          sessionStorage.removeItem(BANNER_RESET_KEY);
        } catch (e) {
          console.warn('CookieBanner: sessionStorage unavailable, could not clear reset flag:', e instanceof Error ? e.message : String(e));
        }
      }
      if (event.data?.type === 'RESET_INITIAL_BUILD_HIDE') {
        setHideForBuilderPreview(false);
        try {
          sessionStorage.setItem(BANNER_RESET_KEY, 'true');
        } catch (e) {
          console.warn('CookieBanner: sessionStorage unavailable, reset flag will not persist:', e instanceof Error ? e.message : String(e));
        }
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (hideForBuilderPreview || !isLoaded || !showBanner) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[10000] bg-white border-t border-gray-200 shadow-lg"
      role="alertdialog"
      aria-live="polite"
      aria-label="Cookie consent banner"
      aria-describedby="cookie-banner-description"
      data-airo-non-editable
    >
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Cookie Consent</h3>
            <p id="cookie-banner-description" className="text-sm text-gray-600">
              Essential storage keeps the site secure and functional. With your permission, optional first-party analytics records data-minimised page and feature usage so we can improve the preview. We do not use this consent for advertising.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Button size="sm" variant="secondary" onClick={() => saveConsent(false)} className="whitespace-nowrap">Decline</Button>
            <Button size="sm" onClick={() => saveConsent(true)} className="whitespace-nowrap" autoFocus>Accept</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
