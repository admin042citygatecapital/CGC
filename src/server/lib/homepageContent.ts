/**
 * homepageContent.ts
 *
 * Bridge between the Admin Configuration Center's "Homepage" tab and the
 * actual content source-of-truth: src/content/pages/home.json
 *
 * The homepage reads its copy via `virtual:content` at build/SSR time.
 * Writing to home.json is the only way changes appear on the live site.
 *
 * This module exposes a flat HomepageAdminView (the shape the Config Center
 * tab uses) and handles the mapping to/from the nested home.json structure.
 */

import fs   from 'node:fs';
import path from 'node:path';

// home.json lives in the project source tree.
// process.cwd() is the project root (/app) in both dev and production.
const HOME_JSON = path.resolve(process.cwd(), 'src/content/pages/home.json');

// ─── Flat admin view ──────────────────────────────────────────────────────────

export interface HomepageAdminView {
  // Hero copy
  trustBadge:     string;
  headline1:      string;
  headlineAccent: string;
  headline2:      string;
  subheadline:    string;
  ctaSecondary:   string;
  // A/B CTA labels
  heroCTAControl: string;
  heroCTAUrgency: string;
  heroCTABenefit: string;
  // Section visibility
  showStats:        boolean;
  showTestimonials: boolean;
  showPartners:     boolean;
  showNewsSection:  boolean;
  // Announcement banner
  announcementBannerEnabled: boolean;
  announcementBannerText:    string;
  announcementBannerType:    'info' | 'warning' | 'success' | 'maintenance';
}

// ─── Defaults (mirrors home.json initial values) ──────────────────────────────

export function defaultHomepageContent(): HomepageAdminView {
  return {
    trustBadge:                'Trusted by 2M+ customers worldwide',
    headline1:                 'The Future of',
    headlineAccent:            'Banking',
    headline2:                 'is Here',
    subheadline:               'Multi-currency wallets, crypto exchange, international transfers, and smart cards — all in one premium platform built for global citizens.',
    ctaSecondary:              'Explore Features',
    heroCTAControl:            'Open Free Account',
    heroCTAUrgency:            'Start Banking Today',
    heroCTABenefit:            'Get $0 Fees Forever',
    showStats:                 true,
    showTestimonials:          true,
    showPartners:              true,
    showNewsSection:           true,
    announcementBannerEnabled: false,
    announcementBannerText:    '',
    announcementBannerType:    'info',
  };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export function readHomepageContent(): HomepageAdminView {
  try {
    const raw  = fs.readFileSync(HOME_JSON, 'utf8');
    const json = JSON.parse(raw);
    const hero = json.hero ?? {};
    const vis  = json._visibility ?? {};
    const ann  = json._announcement ?? {};

    return {
      trustBadge:                hero.trustBadge     ?? defaultHomepageContent().trustBadge,
      headline1:                 hero.headline1      ?? defaultHomepageContent().headline1,
      headlineAccent:            hero.headlineAccent ?? defaultHomepageContent().headlineAccent,
      headline2:                 hero.headline2      ?? defaultHomepageContent().headline2,
      subheadline:               hero.subheadline    ?? defaultHomepageContent().subheadline,
      ctaSecondary:              hero.ctaSecondary   ?? defaultHomepageContent().ctaSecondary,
      heroCTAControl:            hero.heroCTALabels?.control ?? defaultHomepageContent().heroCTAControl,
      heroCTAUrgency:            hero.heroCTALabels?.urgency ?? defaultHomepageContent().heroCTAUrgency,
      heroCTABenefit:            hero.heroCTALabels?.benefit ?? defaultHomepageContent().heroCTABenefit,
      showStats:                 vis.showStats        ?? true,
      showTestimonials:          vis.showTestimonials ?? true,
      showPartners:              vis.showPartners     ?? true,
      showNewsSection:           vis.showNewsSection  ?? true,
      announcementBannerEnabled: ann.enabled  ?? false,
      announcementBannerText:    ann.text     ?? '',
      announcementBannerType:    ann.type     ?? 'info',
    };
  } catch {
    return defaultHomepageContent();
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function writeHomepageContent(view: HomepageAdminView): void {
  // Read the full home.json so we only patch the fields we own
  let json: Record<string, any> = {};
  try {
    json = JSON.parse(fs.readFileSync(HOME_JSON, 'utf8'));
  } catch { /* start fresh if unreadable */ }

  // Patch hero fields
  json.hero = {
    ...(json.hero ?? {}),
    trustBadge:     view.trustBadge,
    headline1:      view.headline1,
    headlineAccent: view.headlineAccent,
    headline2:      view.headline2,
    subheadline:    view.subheadline,
    ctaSecondary:   view.ctaSecondary,
    heroCTALabels: {
      control: view.heroCTAControl,
      urgency: view.heroCTAUrgency,
      benefit: view.heroCTABenefit,
    },
  };

  // Section visibility (stored under a private key so it doesn't pollute hero)
  json._visibility = {
    showStats:        view.showStats,
    showTestimonials: view.showTestimonials,
    showPartners:     view.showPartners,
    showNewsSection:  view.showNewsSection,
  };

  // Announcement banner
  json._announcement = {
    enabled: view.announcementBannerEnabled,
    text:    view.announcementBannerText,
    type:    view.announcementBannerType,
  };

  fs.writeFileSync(HOME_JSON, JSON.stringify(json, null, 2) + '\n');
}
