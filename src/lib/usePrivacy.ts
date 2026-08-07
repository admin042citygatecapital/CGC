/**
 * usePrivacy — global privacy-mode hook
 * Reads/writes localStorage key 'cgc_privacy_mode'.
 * Syncs across tabs via the 'storage' event.
 */
import { useState, useEffect, useCallback } from 'react';

const KEY = 'cgc_privacy_mode';

export function usePrivacy(): { privacy: boolean; toggle: () => void } {
  const [privacy, setPrivacy] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(KEY) === 'true';
  });

  // Sync across tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === KEY) setPrivacy(e.newValue === 'true');
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback(() => {
    setPrivacy(prev => {
      const next = !prev;
      localStorage.setItem(KEY, String(next));
      return next;
    });
  }, []);

  return { privacy, toggle };
}

/** Inline privacy-masked value component helper */
export function mask(value: string, privacy: boolean): string {
  return privacy ? '••••••' : value;
}
