import type { Request, Response } from 'express';
import { updateSection, resetSection } from '../../../lib/configStore.js';
import {
  defaultHomepageAdminView,
  homepageAdminView,
  mergeHomepageAdminView,
  publishHomepageContent,
  readHomepageDocument,
  type HomepageAdminView,
} from '../../../lib/homepageCmsStore.js';

type ConfigSection =
  | 'branding' | 'theme' | 'homepage' | 'dashboardWidgets'
  | 'notificationSettings' | 'maintenanceMode' | 'featureToggles'
  | 'exchangeRates' | 'language' | 'currency' | 'timezone';

const VALID_SECTIONS: ConfigSection[] = [
  'branding', 'theme', 'homepage', 'dashboardWidgets',
  'notificationSettings', 'maintenanceMode', 'featureToggles',
  'exchangeRates', 'language', 'currency', 'timezone',
];

export default async function handler(req: Request, res: Response) {
  try {
    const { section, action, data } =
      req.body as { section: ConfigSection; action?: string; data?: Record<string, unknown> };

    if (!section || !VALID_SECTIONS.includes(section)) {
      return res.status(400).json({ error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(', ')}` });
    }

    // ── Homepage: read/write the actual content JSON (virtual:content source of truth) ──
    if (section === 'homepage') {
      const actor = req.adminSession?.email ?? req.adminSession?.adminId ?? 'unknown-admin';
      if (action === 'reset') {
        const current = readHomepageDocument();
        const defaults = defaultHomepageAdminView();
        publishHomepageContent(
          mergeHomepageAdminView(current.content, defaults),
          actor,
          'Configuration Center homepage reset',
        );
        return res.json({ ok: true, config: { homepage: defaults } });
      }
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'data object required' });
      }
      const current = readHomepageDocument();
      const updated = mergeHomepage(homepageAdminView(current.content), data);
      publishHomepageContent(
        mergeHomepageAdminView(current.content, updated),
        actor,
        'Configuration Center homepage update',
      );
      return res.json({ ok: true, config: { homepage: updated } });
    }

    // ── All other sections: configStore ──────────────────────────────────────
    if (action === 'reset') {
      const cfg = resetSection(section);
      return res.json({ ok: true, config: cfg });
    }

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'data object required' });
    }

    const cfg = updateSection(section, data as any);
    const safe = { ...cfg, exchangeRates: { ...cfg.exchangeRates, apiKey: cfg.exchangeRates.apiKey ? '••••••••' : '' } };
    res.json({ ok: true, config: safe });
  } catch (err) {
    console.error('admin.config.save.error', { errorType: err instanceof Error ? err.name : 'UnknownError' });
    res.status(500).json({ error: 'Failed to save configuration.' });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mergeHomepage(
  current: HomepageAdminView,
  patch: Record<string, unknown>
): HomepageAdminView {
  return {
    trustBadge:                String(patch.trustBadge                ?? current.trustBadge),
    headline1:                 String(patch.headline1                 ?? current.headline1),
    headlineAccent:            String(patch.headlineAccent            ?? current.headlineAccent),
    headline2:                 String(patch.headline2                 ?? current.headline2),
    subheadline:               String(patch.subheadline               ?? current.subheadline),
    ctaSecondary:              String(patch.ctaSecondary              ?? current.ctaSecondary),
    heroCTAControl:            String(patch.heroCTAControl            ?? current.heroCTAControl),
    heroCTAUrgency:            String(patch.heroCTAUrgency            ?? current.heroCTAUrgency),
    heroCTABenefit:            String(patch.heroCTABenefit            ?? current.heroCTABenefit),
    showStats:                 Boolean(patch.showStats                ?? current.showStats),
    showTestimonials:          Boolean(patch.showTestimonials         ?? current.showTestimonials),
    showPartners:              Boolean(patch.showPartners             ?? current.showPartners),
    showNewsSection:           Boolean(patch.showNewsSection          ?? current.showNewsSection),
    announcementBannerEnabled: Boolean(patch.announcementBannerEnabled ?? current.announcementBannerEnabled),
    announcementBannerText:    String(patch.announcementBannerText    ?? current.announcementBannerText),
    announcementBannerType:    (patch.announcementBannerType as any)  ?? current.announcementBannerType,
  };
}
