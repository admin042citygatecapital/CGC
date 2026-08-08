import { useEffect, useState } from 'react';
import {
  DEFAULT_PREVIEW_NOTICE,
  type PreviewNoticeSettings,
} from '@/lib/previewNotice';

const DEFAULT_SETTINGS: PreviewNoticeSettings = {
  enabled: true,
  text: DEFAULT_PREVIEW_NOTICE,
  position: 'bottom',
  tone: 'amber',
  compact: false,
};

export default function PreviewBanner() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/settings/preview', { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        if (payload?.data) setSettings(payload.data as PreviewNoticeSettings);
      })
      .catch(() => {
        // Fail closed: keep the accurate built-in preview notice visible.
      });
    return () => controller.abort();
  }, []);

  if (!settings.enabled) return null;

  const edge = settings.position === 'top' ? 'top-0 border-b' : 'bottom-0 border-t';
  const tone = settings.tone === 'neutral'
    ? 'border-white/15 bg-[#111318]/95 text-white/80'
    : 'border-amber-400/30 bg-[#17120a]/95 text-amber-100';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 z-[10000] ${edge} ${tone} px-4 text-center text-[11px] font-medium backdrop-blur-md ${settings.compact ? 'py-1' : 'py-2'}`}
    >
      {settings.text}
    </div>
  );
}
