/**
 * cmsExtStore.ts
 * Persistent store for CMS extensions:
 *   - Hero media (images / videos)
 *   - Logo variants
 *   - Navigation links
 *   - Feature cards
 *   - News articles
 *   - Blog posts
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { privateSubdirectory } from './storagePaths.js';
import { readConfigDocument, writeConfigDocument } from './durableConfigDocument.js';

const DIR = privateSubdirectory('cms');
const FILES = {
  heroMedia:  path.join(DIR, 'hero_media.json'),
  logo:       path.join(DIR, 'logo.json'),
  navigation: path.join(DIR, 'navigation.json'),
  features:   path.join(DIR, 'features.jsonl'),
  news:       path.join(DIR, 'news.jsonl'),
  blog:       path.join(DIR, 'blog.jsonl'),
};
const KEYS = {
  heroMedia: 'cms_ext_hero_media', logo: 'cms_ext_logo', navigation: 'cms_ext_navigation',
  features: 'cms_ext_features', news: 'cms_ext_news', blog: 'cms_ext_blog',
} as const;

async function readJson<T>(key: string, file: string, def: T): Promise<T> {
  return readConfigDocument<T>(key, file, def);
}
async function writeJson<T>(key: string, file: string, data: T, updatedBy = 'admin'): Promise<void> {
  await writeConfigDocument(key, file, data, updatedBy);
}
function readLegacyJsonl<T>(file: string): T[] {
  try {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line) as T);
  } catch { return []; }
}
async function readJsonl<T>(key: string, file: string): Promise<T[]> {
  return readConfigDocument<T[]>(key, file, readLegacyJsonl<T>(file));
}
async function writeJsonl<T>(key: string, file: string, items: T[], updatedBy = 'admin'): Promise<void> {
  await writeConfigDocument(key, file, items, updatedBy);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HeroMedia {
  heroImageUrl: string;
  heroImageAlt: string;
  heroVideoUrl: string;
  heroVideoType: 'mp4' | 'webm' | 'youtube' | 'vimeo';
  heroVideoAutoplay: boolean;
  heroVideoMuted: boolean;
  heroVideoLoop: boolean;
  heroMediaType: 'image' | 'video' | 'none';
  backgroundOverlay: number;   // 0–100 opacity %
  updatedAt: string;
}

export interface LogoConfig {
  primaryLogoUrl: string;
  darkLogoUrl: string;
  faviconUrl: string;
  logoAlt: string;
  logoWidth: number;
  logoHeight: number;
  updatedAt: string;
}

export interface NavLink {
  id: string;
  label: string;
  href: string;
  target: '_self' | '_blank';
  order: number;
  section: 'main' | 'footer' | 'legal';
  enabled: boolean;
  children: { label: string; href: string }[];
}

export interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  imageUrl: string;
  badge: string;
  order: number;
  enabled: boolean;
  page: string;   // which page this card appears on
  createdAt: string;
  updatedAt: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  imageUrl: string;
  imageAlt: string;
  category: string;
  tags: string[];
  author: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt: string | null;
  featured: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  imageUrl: string;
  imageAlt: string;
  category: string;
  tags: string[];
  author: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt: string | null;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  readingTime: number;   // minutes
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Hero Media ───────────────────────────────────────────────────────────────

const DEFAULT_HERO: HeroMedia = {
  heroImageUrl: '', heroImageAlt: 'City Gate Capital — Secure Digital Banking',
  heroVideoUrl: '', heroVideoType: 'mp4', heroVideoAutoplay: true,
  heroVideoMuted: true, heroVideoLoop: true, heroMediaType: 'none',
  backgroundOverlay: 40, updatedAt: new Date().toISOString(),
};

export async function getHeroMedia(): Promise<HeroMedia> {
  return { ...DEFAULT_HERO, ...await readJson<Partial<HeroMedia>>(KEYS.heroMedia, FILES.heroMedia, {}) };
}
export async function saveHeroMedia(patch: Partial<HeroMedia>, updatedBy = 'admin'): Promise<HeroMedia> {
  const next = { ...await getHeroMedia(), ...patch, updatedAt: new Date().toISOString() };
  await writeJson(KEYS.heroMedia, FILES.heroMedia, next, updatedBy);
  return next;
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

const DEFAULT_LOGO: LogoConfig = {
  primaryLogoUrl: '', darkLogoUrl: '', faviconUrl: '',
  logoAlt: 'City Gate Capital', logoWidth: 160, logoHeight: 40,
  updatedAt: new Date().toISOString(),
};

export async function getLogoConfig(): Promise<LogoConfig> {
  return { ...DEFAULT_LOGO, ...await readJson<Partial<LogoConfig>>(KEYS.logo, FILES.logo, {}) };
}
export async function saveLogoConfig(patch: Partial<LogoConfig>, updatedBy = 'admin'): Promise<LogoConfig> {
  const next = { ...await getLogoConfig(), ...patch, updatedAt: new Date().toISOString() };
  await writeJson(KEYS.logo, FILES.logo, next, updatedBy);
  return next;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

const DEFAULT_NAV: NavLink[] = [
  { id: '1', label: 'Home',            href: '/',                target: '_self', order: 1, section: 'main',   enabled: true, children: [] },
  { id: '2', label: 'Digital Banking', href: '/digital-banking', target: '_self', order: 2, section: 'main',   enabled: true, children: [] },
  { id: '3', label: 'Accounts',        href: '/accounts',        target: '_self', order: 3, section: 'main',   enabled: true, children: [] },
  { id: '4', label: 'Exchange',        href: '/exchange',        target: '_self', order: 4, section: 'main',   enabled: true, children: [] },
  { id: '5', label: 'Contact',         href: '/contact',         target: '_self', order: 5, section: 'main',   enabled: true, children: [] },
  { id: '6', label: 'Privacy Policy',  href: '/privacy',         target: '_self', order: 1, section: 'legal',  enabled: true, children: [] },
  { id: '7', label: 'Terms of Service',href: '/terms',           target: '_self', order: 2, section: 'legal',  enabled: true, children: [] },
];

export async function getNavigation(): Promise<NavLink[]> {
  const saved = await readJson<NavLink[] | null>(KEYS.navigation, FILES.navigation, null);
  return saved ?? DEFAULT_NAV;
}
export async function saveNavigation(links: NavLink[], updatedBy = 'admin'): Promise<NavLink[]> {
  await writeJson(KEYS.navigation, FILES.navigation, links, updatedBy);
  return links;
}

// ─── Feature Cards ────────────────────────────────────────────────────────────

export async function getFeatureCards(page?: string): Promise<FeatureCard[]> {
  const all = await readJsonl<FeatureCard>(KEYS.features, FILES.features);
  if (all.length === 0) {
    const defaults: FeatureCard[] = [
      { id: randomUUID(), title: 'Multi-Currency Wallet Preview', description: 'Explore a demonstration interface for proposed multi-currency features. No funds are held or transferred.', icon: 'Wallet', imageUrl: '', badge: 'Preview', order: 1, enabled: true, page: 'home', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: randomUUID(), title: 'Transfer Simulation', description: 'Explore proposed global transfer flows without moving money.', icon: 'Zap', imageUrl: '', badge: '', order: 2, enabled: true, page: 'home', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: randomUUID(), title: 'Virtual Card Prototype', description: 'Preview proposed virtual-card controls. No payment card is issued.', icon: 'CreditCard', imageUrl: '', badge: 'Preview', order: 3, enabled: true, page: 'home', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: randomUUID(), title: 'Paper Exchange', description: 'Explore illustrative crypto exchange flows without custody or order execution.', icon: 'TrendingUp', imageUrl: '', badge: '', order: 4, enabled: true, page: 'home', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    await writeJsonl(KEYS.features, FILES.features, defaults, 'migration');
    return page ? defaults.filter(f => f.page === page) : defaults;
  }
  return page ? all.filter(f => f.page === page) : all;
}

export async function upsertFeatureCard(data: Partial<FeatureCard> & { id?: string }, updatedBy = 'admin'): Promise<FeatureCard> {
  const all = await readJsonl<FeatureCard>(KEYS.features, FILES.features);
  const idx = data.id ? all.findIndex(f => f.id === data.id) : -1;
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
    await writeJsonl(KEYS.features, FILES.features, all, updatedBy);
    return all[idx];
  }
  const card: FeatureCard = {
    id: randomUUID(), title: data.title ?? '', description: data.description ?? '',
    icon: data.icon ?? 'Star', imageUrl: data.imageUrl ?? '', badge: data.badge ?? '',
    order: data.order ?? all.length + 1, enabled: data.enabled ?? true,
    page: data.page ?? 'home', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  all.push(card);
  await writeJsonl(KEYS.features, FILES.features, all, updatedBy);
  return card;
}

export async function deleteFeatureCard(id: string, updatedBy = 'admin'): Promise<boolean> {
  const all = await readJsonl<FeatureCard>(KEYS.features, FILES.features);
  const next = all.filter(f => f.id !== id);
  if (next.length === all.length) return false;
  await writeJsonl(KEYS.features, FILES.features, next, updatedBy);
  return true;
}

// ─── News ─────────────────────────────────────────────────────────────────────

export async function getNews(opts: { status?: string; category?: string; search?: string; page?: number; limit?: number } = {}) {
  let all = await readJsonl<NewsArticle>(KEYS.news, FILES.news);
  if (opts.status && opts.status !== 'all') all = all.filter(n => n.status === opts.status);
  if (opts.category && opts.category !== 'all') all = all.filter(n => n.category === opts.category);
  if (opts.search) { const q = opts.search.toLowerCase(); all = all.filter(n => n.title.toLowerCase().includes(q) || n.excerpt.toLowerCase().includes(q)); }
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const total = all.length;
  const p = opts.page ?? 1; const l = opts.limit ?? 20;
  return { data: all.slice((p - 1) * l, p * l), total };
}

export async function upsertNews(data: Partial<NewsArticle> & { id?: string }, updatedBy = 'admin'): Promise<NewsArticle> {
  const all = await readJsonl<NewsArticle>(KEYS.news, FILES.news);
  const idx = data.id ? all.findIndex(n => n.id === data.id) : -1;
  if (idx >= 0) {
    if (data.status === 'published' && !all[idx].publishedAt) data.publishedAt = new Date().toISOString();
    all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
    await writeJsonl(KEYS.news, FILES.news, all, updatedBy);
    return all[idx];
  }
  const slug = (data.title ?? 'article').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
  const article: NewsArticle = {
    id: randomUUID(), title: data.title ?? '', slug: data.slug ?? slug,
    excerpt: data.excerpt ?? '', body: data.body ?? '', imageUrl: data.imageUrl ?? '',
    imageAlt: data.imageAlt ?? '', category: data.category ?? 'General',
    tags: data.tags ?? [], author: data.author ?? 'CGC Editorial',
    status: data.status ?? 'draft', publishedAt: data.status === 'published' ? new Date().toISOString() : null,
    featured: data.featured ?? false, viewCount: 0,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  all.push(article);
  await writeJsonl(KEYS.news, FILES.news, all, updatedBy);
  return article;
}

export async function deleteNews(id: string, updatedBy = 'admin'): Promise<boolean> {
  const all = await readJsonl<NewsArticle>(KEYS.news, FILES.news);
  const next = all.filter(n => n.id !== id);
  if (next.length === all.length) return false;
  await writeJsonl(KEYS.news, FILES.news, next, updatedBy);
  return true;
}

// ─── Blog ─────────────────────────────────────────────────────────────────────

export async function getBlog(opts: { status?: string; category?: string; search?: string; page?: number; limit?: number } = {}) {
  let all = await readJsonl<BlogPost>(KEYS.blog, FILES.blog);
  if (opts.status && opts.status !== 'all') all = all.filter(b => b.status === opts.status);
  if (opts.category && opts.category !== 'all') all = all.filter(b => b.category === opts.category);
  if (opts.search) { const q = opts.search.toLowerCase(); all = all.filter(b => b.title.toLowerCase().includes(q) || b.excerpt.toLowerCase().includes(q)); }
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const total = all.length;
  const p = opts.page ?? 1; const l = opts.limit ?? 20;
  return { data: all.slice((p - 1) * l, p * l), total };
}

export async function upsertBlog(data: Partial<BlogPost> & { id?: string }, updatedBy = 'admin'): Promise<BlogPost> {
  const all = await readJsonl<BlogPost>(KEYS.blog, FILES.blog);
  const idx = data.id ? all.findIndex(b => b.id === data.id) : -1;
  if (idx >= 0) {
    if (data.status === 'published' && !all[idx].publishedAt) data.publishedAt = new Date().toISOString();
    all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
    await writeJsonl(KEYS.blog, FILES.blog, all, updatedBy);
    return all[idx];
  }
  const slug = (data.title ?? 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
  const words = (data.body ?? '').split(/\s+/).length;
  const post: BlogPost = {
    id: randomUUID(), title: data.title ?? '', slug: data.slug ?? slug,
    excerpt: data.excerpt ?? '', body: data.body ?? '', imageUrl: data.imageUrl ?? '',
    imageAlt: data.imageAlt ?? '', category: data.category ?? 'Finance',
    tags: data.tags ?? [], author: data.author ?? 'CGC Editorial',
    status: data.status ?? 'draft', publishedAt: data.status === 'published' ? new Date().toISOString() : null,
    featured: data.featured ?? false, seoTitle: data.seoTitle ?? data.title ?? '',
    seoDescription: data.seoDescription ?? data.excerpt ?? '',
    readingTime: Math.max(1, Math.ceil(words / 200)),
    viewCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  all.push(post);
  await writeJsonl(KEYS.blog, FILES.blog, all, updatedBy);
  return post;
}

export async function deleteBlog(id: string, updatedBy = 'admin'): Promise<boolean> {
  const all = await readJsonl<BlogPost>(KEYS.blog, FILES.blog);
  const next = all.filter(b => b.id !== id);
  if (next.length === all.length) return false;
  await writeJsonl(KEYS.blog, FILES.blog, next, updatedBy);
  return true;
}
