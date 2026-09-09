import type { Request, Response } from 'express';
import { updateSection, resetSection, redactConfigSecrets } from '../../../lib/configStore.js';
import { appendCriticalAudit } from '../../../lib/auditLog.js';
import { authorizeRecentAdminStepUp } from '../../../lib/rbacMiddleware.js';
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
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { section, action, data, reason, confirmation } =
      req.body as { section: ConfigSection; action?: string; data?: Record<string, unknown>; reason?: string; confirmation?: string };

    if (!section || !VALID_SECTIONS.includes(section)) {
      return res.status(400).json({ error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(', ')}` });
    }

    if (section === 'maintenanceMode') {
      if (!authorizeRecentAdminStepUp(req, res)) return;
      if (String(reason ?? '').trim().length < 8) return res.status(400).json({ error: 'A clear operational reason is required.' });
      if (String(confirmation ?? '') !== 'CONFIRM MAINTENANCE MODE') return res.status(409).json({ error: 'Type CONFIRM MAINTENANCE MODE to continue.' });
      await appendCriticalAudit({
        event: 'admin_maintenance_mode_change_authorized',
        adminId: req.adminSession?.adminId,
        email: req.adminSession?.email,
        ip: req.ip,
        reason: String(reason),
        meta: { enabled: Boolean(data?.enabled), requestId: String(req.get('X-Request-ID') ?? '') },
      });
    }

    // ── Homepage: read/write the actual content JSON (virtual:content source of truth) ──
    if (section === 'homepage') {
      const actor = req.adminSession?.email ?? req.adminSession?.adminId ?? 'unknown-admin';
      const adminId = req.adminSession?.adminId ?? 'unknown-admin';
      if (action === 'reset') {
        const current = await readHomepageDocument();
        const defaults = defaultHomepageAdminView();
        await appendCriticalAudit({ event: 'admin_homepage_reset_intent', adminId, ip: req.ip, reason: 'Configuration Center homepage reset' });
        await publishHomepageContent(
          mergeHomepageAdminView(current.content, defaults),
          actor,
          'Configuration Center homepage reset',
        );
        return res.json({ ok: true, config: { homepage: defaults } });
      }
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'data object required' });
      }
      const current = await readHomepageDocument();
      const updated = mergeHomepage(homepageAdminView(current.content), data);
      await appendCriticalAudit({ event: 'admin_homepage_update_intent', adminId, ip: req.ip, reason: 'Configuration Center homepage update' });
      await publishHomepageContent(
        mergeHomepageAdminView(current.content, updated),
        actor,
        'Configuration Center homepage update',
      );
      return res.json({ ok: true, config: { homepage: updated } });
    }

    // ── All other sections: configStore ──────────────────────────────────────
    if (action === 'reset') {
      const cfg = await resetSection(section);
      return res.json({ ok: true, config: redactConfigSecrets(cfg) });
    }

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'data object required' });
    }

    const cfg = await updateSection(section, data as any);
    if (section === 'maintenanceMode') {
      await appendCriticalAudit({
        event: 'admin_maintenance_mode_changed', adminId: req.adminSession?.adminId,
        email: req.adminSession?.email, ip: req.ip, reason: String(reason),
        meta: { enabled: Boolean(data?.enabled) },
      });
    }
    const safe = redactConfigSecrets(cfg);
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
