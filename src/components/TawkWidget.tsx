/**
 * Privacy-conscious Tawk live support integration.
 *
 * The third-party script is loaded only after a visitor opens support. The
 * custom City Gate launcher keeps brand presentation under our control while
 * the conversation itself remains hosted by Tawk. We deliberately send only
 * coarse journey context — never names, email addresses, balances, KYC data,
 * account numbers, or other financial information.
 */
import { Loader2, MessageCircle, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useCustomerAuth } from '@/lib/customerAuth';
import {
  getTawkContextAttributes,
  shouldOfferBankingSupport,
  type TawkAvailability,
} from '@/lib/tawkSupport';

const PROPERTY_ID = (import.meta.env.VITE_TAWK_PROPERTY_ID || '6a773b21198d971d45c5ff66').trim();
const WIDGET_ID = (import.meta.env.VITE_TAWK_WIDGET_ID || '1jvgrtvnn').trim();
const EMBED_ID_PATTERN = /^[a-z0-9]+$/i;
const SCRIPT_ID = 'city-gate-tawk-widget';

type TawkStatus = 'idle' | 'loading' | 'ready' | 'error';

interface TawkApi {
  onLoad?: () => void;
  onChatMaximized?: () => void;
  onChatMinimized?: () => void;
  onChatEnded?: () => void;
  onStatusChange?: (status: TawkAvailability) => void;
  hideWidget?: () => void;
  showWidget?: () => void;
  maximize?: () => void;
  getStatus?: () => TawkAvailability;
  setAttributes?: (attributes: Record<string, string>, callback?: (error?: unknown) => void) => void;
}

declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
    __cityGateTawkLoaded?: boolean;
  }
}

function validConfiguration(): boolean {
  return EMBED_ID_PATTERN.test(PROPERTY_ID) && EMBED_ID_PATTERN.test(WIDGET_ID);
}

function safely(action: () => void): void {
  try {
    action();
  } catch (error) {
    console.warn('[Tawk] Support action failed:', error);
  }
}

export default function TawkWidget() {
  const location = useLocation();
  const { customer } = useCustomerAuth();
  const [status, setStatus] = useState<TawkStatus>('idle');
  const [availability, setAvailability] = useState<TawkAvailability>('offline');
  const [chatOpen, setChatOpen] = useState(false);
  const pendingOpen = useRef(false);
  const chatOpenRef = useRef(false);
  const showLauncher = shouldOfferBankingSupport(location.pathname);

  const applyContext = useCallback(() => {
    const attributes = getTawkContextAttributes(location.pathname, Boolean(customer));
    safely(() => window.Tawk_API?.setAttributes?.(attributes, error => {
      if (error) console.warn('[Tawk] Visitor context was not applied.');
    }));
  }, [customer, location.pathname]);

  const openLoadedWidget = useCallback(() => {
    chatOpenRef.current = true;
    safely(() => {
      window.Tawk_API?.showWidget?.();
      window.Tawk_API?.maximize?.();
    });
    // Tawk can report `onLoad` just before the consent-enabled iframe is ready
    // to accept `maximize`. Retry once after the frame has mounted so the
    // visitor's first click consistently opens the conversation.
    window.setTimeout(() => safely(() => window.Tawk_API?.maximize?.()), 300);
    setChatOpen(true);
  }, []);

  const configureCallbacks = useCallback(() => {
    const api = (window.Tawk_API = window.Tawk_API || {});
    api.onLoad = () => {
      setStatus('ready');
      setAvailability(api.getStatus?.() ?? 'offline');
      applyContext();
      if (pendingOpen.current) {
        pendingOpen.current = false;
        openLoadedWidget();
      } else if (!chatOpenRef.current) {
        safely(() => api.hideWidget?.());
      }
    };
    api.onChatMaximized = () => {
      chatOpenRef.current = true;
      setChatOpen(true);
    };
    api.onChatMinimized = () => {
      chatOpenRef.current = false;
      setChatOpen(false);
      safely(() => api.hideWidget?.());
    };
    api.onChatEnded = () => {
      chatOpenRef.current = false;
      setChatOpen(false);
      safely(() => api.hideWidget?.());
    };
    api.onStatusChange = next => setAvailability(next);
  }, [applyContext, openLoadedWidget]);

  const injectWidget = useCallback(() => {
    if (!validConfiguration()) {
      setStatus('error');
      return;
    }

    configureCallbacks();
    if (window.__cityGateTawkLoaded || document.getElementById(SCRIPT_ID)) return;

    window.__cityGateTawkLoaded = true;
    window.Tawk_LoadStart = new Date();
    setStatus('loading');

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.charset = 'UTF-8';
    script.src = `https://embed.tawk.to/${PROPERTY_ID}/${WIDGET_ID}`;
    script.setAttribute('crossorigin', '*');
    script.onload = () => {
      let attempts = 0;
      const openWhenReady = () => {
        if (!pendingOpen.current) return;
        const api = window.Tawk_API;
        if (typeof api?.showWidget === 'function' && typeof api.maximize === 'function') {
          pendingOpen.current = false;
          setStatus('ready');
          setAvailability(api.getStatus?.() ?? 'offline');
          applyContext();
          openLoadedWidget();
          return;
        }
        attempts += 1;
        if (attempts < 40) {
          window.setTimeout(openWhenReady, 250);
        } else {
          pendingOpen.current = false;
          setStatus('error');
        }
      };
      openWhenReady();
    };
    script.onerror = () => {
      window.__cityGateTawkLoaded = false;
      pendingOpen.current = false;
      script.remove();
      setStatus('error');
      console.warn('[Tawk] Banking support could not be loaded.');
    };
    document.head.appendChild(script);
  }, [applyContext, configureCallbacks, openLoadedWidget]);

  const openSupport = useCallback(() => {
    if (status === 'ready') {
      openLoadedWidget();
      return;
    }
    pendingOpen.current = true;
    injectWidget();
  }, [injectWidget, openLoadedWidget, status]);

  useEffect(() => {
    if (!showLauncher) {
      pendingOpen.current = false;
      chatOpenRef.current = false;
      setChatOpen(false);
      safely(() => window.Tawk_API?.hideWidget?.());
      return;
    }
    if (status === 'ready') {
      applyContext();
      if (!chatOpenRef.current) safely(() => window.Tawk_API?.hideWidget?.());
    }
  }, [applyContext, showLauncher, status]);

  if (!showLauncher || chatOpen) return null;

  const isLoading = status === 'loading';
  const isOnline = availability === 'online';
  const statusLabel = status === 'error'
    ? 'Retry secure support'
    : isLoading
      ? 'Connecting securely…'
      : isOnline
        ? 'Team online'
        : 'Leave us a message';

  return (
    <aside className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-[9998] max-w-[calc(100vw-2rem)]">
      <button
        type="button"
        onClick={openSupport}
        disabled={isLoading}
        aria-label="Open City Gate Capital product support"
        className="group relative flex items-center gap-3 rounded-2xl border border-[#D7B458]/35 bg-[#090909]/95 py-2.5 pl-2.5 pr-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.55),0_0_30px_rgba(201,168,76,0.16)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#E6C76A]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D7B458] disabled:cursor-wait"
      >
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E6C76A]/30 bg-gradient-to-br from-[#1B160B] to-black">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#E6C76A]" aria-hidden="true" />
          ) : (
            <img
              src="/assets/brand/city-gate-capital-seal.png"
              alt=""
              className="h-11 w-11 object-contain"
            />
          )}
          {!isLoading && (
            <span className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-black ${isOnline ? 'bg-emerald-400' : 'bg-[#D7B458]'}`} />
          )}
        </span>

        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
            Banking support
            <ShieldCheck className="h-3.5 w-3.5 text-[#D7B458]" aria-hidden="true" />
          </span>
          <span className="mt-0.5 block text-[11px] text-white/55">{statusLabel}</span>
          <span className="mt-1 hidden text-[10px] text-[#D7B458]/70 sm:block">Never share passwords or verification codes</span>
        </span>

        <MessageCircle className="ml-1 h-5 w-5 shrink-0 text-[#D7B458] transition-transform group-hover:scale-110" aria-hidden="true" />
      </button>
    </aside>
  );
}
