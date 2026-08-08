import { describe, expect, it } from 'vitest';
import { resolveWebsiteAnnouncement } from '../lib/websiteAnnouncement';

describe('website announcement settings', () => {
  it('returns a safe enabled public announcement', () => {
    expect(resolveWebsiteAnnouncement({
      announcementEnabled: true,
      announcementText: 'The product preview is back online.',
      announcementLink: '/',
    })).toEqual({
      enabled: true,
      text: 'The product preview is back online.',
      link: '/',
    });
  });

  it('rejects external or executable links', () => {
    const external = resolveWebsiteAnnouncement({
      announcementEnabled: true,
      announcementText: 'The product preview is back online.',
      announcementLink: 'javascript:alert(1)',
    });
    expect(external.link).toBe('');
  });

  it('hides missing or undersized announcements', () => {
    expect(resolveWebsiteAnnouncement({ announcementEnabled: true, announcementText: 'Short' }).enabled).toBe(false);
  });
});
