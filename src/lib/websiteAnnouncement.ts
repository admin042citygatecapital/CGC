export interface WebsiteAnnouncement {
  enabled: boolean;
  text: string;
  link: string;
}

type WebsiteAnnouncementSource = {
  announcementEnabled?: unknown;
  announcementText?: unknown;
  announcementLink?: unknown;
};

export function resolveWebsiteAnnouncement(
  source: WebsiteAnnouncementSource | null | undefined,
): WebsiteAnnouncement {
  const text = typeof source?.announcementText === 'string'
    ? source.announcementText.trim().slice(0, 300)
    : '';
  const candidateLink = typeof source?.announcementLink === 'string'
    ? source.announcementLink.trim()
    : '';
  const link = candidateLink.startsWith('/') || candidateLink.startsWith('https://citygate.capital')
    ? candidateLink.slice(0, 200)
    : '';

  return {
    enabled: source?.announcementEnabled === true && text.length >= 10,
    text,
    link,
  };
}
