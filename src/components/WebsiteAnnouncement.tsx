import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { WebsiteAnnouncement as AnnouncementSettings } from '@/lib/websiteAnnouncement';

const HIDDEN: AnnouncementSettings = { enabled: false, text: '', link: '' };

export default function WebsiteAnnouncement() {
  const [announcement, setAnnouncement] = useState(HIDDEN);
  const location = useLocation();

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/settings/website', { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        if (payload?.data?.announcement) setAnnouncement(payload.data.announcement);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const isDemoWorkspace = location.pathname === '/demo'
    || location.pathname.startsWith('/demo/')
    || location.pathname === '/login'
    || location.pathname === '/register'
    || location.pathname.startsWith('/dashboard');
  const isDemoAnnouncement = /\b(?:demo|demonstration|product preview|preview environment)\b/i.test(announcement.text);
  if (!announcement.enabled || (isDemoAnnouncement && !isDemoWorkspace)) return null;

  const content = (
    <span className="block px-4 py-2 text-center text-xs font-semibold text-black">
      {announcement.text}
    </span>
  );

  return (
    <aside
      role="status"
      aria-live="polite"
      className="border-b border-black/10 bg-gradient-to-r from-[#C9A84C] via-[#F0D080] to-[#C9A84C]"
    >
      {announcement.link ? (
        <a href={announcement.link} className="block transition-[filter] hover:brightness-105">
          {content}
        </a>
      ) : content}
    </aside>
  );
}
