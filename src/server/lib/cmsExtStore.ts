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

const DIR = '/private/cms';
const FILES = {
  heroMedia:  path.join(DIR, 'hero_media.json'),
  logo:       path.join(DIR, 'logo.json'),
  navigation: path.join(DIR, 'navigation.json'),
  features:   path.join(DIR, 'features.jsonl'),
  news:       path.join(DIR, 'news.jsonl'),
  blog:       path.join(DIR, 'blog.jsonl'),
};

function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
}
function readJson<T>(file: string, def: T): T {
  try {
    ensureDir();
    if (!fs.existsSync(file)) return def;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return def; }
}
function writeJson<T>(file: string, data: T): void {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function readJsonl<T>(file: string): T[] {
  try {
    ensureDir();
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch { return []; }
}
function writeJsonl<T>(file: string, items: T[]): void {
  ensureDir();
  fs.writeFileSync(file, items.map(i => JSON.stringify(i)).join('\n') + '\n');
}
function appendJsonl<T>(file: string, item: T): void {
  ensureDir();
  fs.appendFileSync(file, JSON.stringify(item) + '\n');
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

export function getHeroMedia(): HeroMedia {
  return { ...DEFAULT_HERO, ...readJson<Partial<HeroMedia>>(FILES.heroMedia, {}) };
}
export function saveHeroMedia(patch: Partial<HeroMedia>): HeroMedia {
  const next = { ...getHeroMedia(), ...patch, updatedAt: new Date().toISOString() };
  writeJson(FILES.heroMedia, next);
  return next;
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

const DEFAULT_LOGO: LogoConfig = {
  primaryLogoUrl: '', darkLogoUrl: '', faviconUrl: '',
  logoAlt: 'City Gate Capital', logoWidth: 160, logoHeight: 40,
  updatedAt: new Date().toISOString(),
};

export function getLogoConfig(): LogoConfig {
  return { ...DEFAULT_LOGO, ...readJson<Partial<LogoConfig>>(FILES.logo, {}) };
}
export function saveLogoConfig(patch: Partial<LogoConfig>): LogoConfig {
  const next = { ...getLogoConfig(), ...patch, updatedAt: new Date().toISOString() };
  writeJson(FILES.logo, next);
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

export function getNavigation(): NavLink[] {
  const saved = readJson<NavLink[] | null>(FILES.navigation, null);
  return saved ?? DEFAULT_NAV;
}
export function saveNavigation(links: NavLink[]): NavLink[] {
  writeJson(FILES.navigation, links);
  return links;
}

// ─── Feature Cards ────────────────────────────────────────────────────────────

export function getFeatureCards(page?: string): FeatureCard[] {
  const all = readJsonl<FeatureCard>(FILES.features);
  if (all.length === 0) {
    const defaults: FeatureCard[] = [
      { id: randomUUID(), title: 'Multi-Currency Wallets', description: 'Hold, send and receive in 30+ currencies with real mid-market rates.', icon: 'Wallet', imageUrl: '', badge: 'Popular', order: 1, enabled: true, page: 'home', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: randomUUID(), title: 'Instant Transfers', description: 'Send money globally in seconds. No hidden fees, no delays.', icon: 'Zap', imageUrl: '', badge: '', order: 2, enabled: true, page: 'home', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: randomUUID(), title: 'Virtual Cards', description: 'Create disposable virtual cards for secure online shopping.', icon: 'CreditCard', imageUrl: '', badge: 'New', order: 3, enabled: true, page: 'home', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: randomUUID(), title: 'Crypto Exchange', description: 'Buy, sell and swap 50+ cryptocurrencies at competitive rates.', icon: 'TrendingUp', imageUrl: '', badge: '', order: 4, enabled: true, page: 'home', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    writeJsonl(FILES.features, defaults);
    return page ? defaults.filter(f => f.page === page) : defaults;
  }
  return page ? all.filter(f => f.page === page) : all;
}

export function upsertFeatureCard(data: Partial<FeatureCard> & { id?: string }): FeatureCard {
  const all = readJsonl<FeatureCard>(FILES.features);
  const idx = data.id ? all.findIndex(f => f.id === data.id) : -1;
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
    writeJsonl(FILES.features, all);
    return all[idx];
  }
  const card: FeatureCard = {
    id: randomUUID(), title: data.title ?? '', description: data.description ?? '',
    icon: data.icon ?? 'Star', imageUrl: data.imageUrl ?? '', badge: data.badge ?? '',
    order: data.order ?? all.length + 1, enabled: data.enabled ?? true,
    page: data.page ?? 'home', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  appendJsonl(FILES.features, card);
  return card;
}

export function deleteFeatureCard(id: string): boolean {
  const all = readJsonl<FeatureCard>(FILES.features);
  const next = all.filter(f => f.id !== id);
  if (next.length === all.length) return false;
  writeJsonl(FILES.features, next);
  return true;
}

// ─── News ─────────────────────────────────────────────────────────────────────

export function getNews(opts: { status?: string; category?: string; search?: string; page?: number; limit?: number } = {}) {
  let all = readJsonl<NewsArticle>(FILES.news);
  if (opts.status && opts.status !== 'all') all = all.filter(n => n.status === opts.status);
  if (opts.category && opts.category !== 'all') all = all.filter(n => n.category === opts.category);
  if (opts.search) { const q = opts.search.toLowerCase(); all = all.filter(n => n.title.toLowerCase().includes(q) || n.excerpt.toLowerCase().includes(q)); }
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const total = all.length;
  const p = opts.page ?? 1; const l = opts.limit ?? 20;
  return { data: all.slice((p - 1) * l, p * l), total };
}

export function upsertNews(data: Partial<NewsArticle> & { id?: string }): NewsArticle {
  const all = readJsonl<NewsArticle>(FILES.news);
  const idx = data.id ? all.findIndex(n => n.id === data.id) : -1;
  if (idx >= 0) {
    if (data.status === 'published' && !all[idx].publishedAt) data.publishedAt = new Date().toISOString();
    all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
    writeJsonl(FILES.news, all);
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
  appendJsonl(FILES.news, article);
  return article;
}

export function deleteNews(id: string): boolean {
  const all = readJsonl<NewsArticle>(FILES.news);
  const next = all.filter(n => n.id !== id);
  if (next.length === all.length) return false;
  writeJsonl(FILES.news, next);
  return true;
}

// ─── Blog ─────────────────────────────────────────────────────────────────────

export function getBlog(opts: { status?: string; category?: string; search?: string; page?: number; limit?: number } = {}) {
  let all = readJsonl<BlogPost>(FILES.blog);
  if (opts.status && opts.status !== 'all') all = all.filter(b => b.status === opts.status);
  if (opts.category && opts.category !== 'all') all = all.filter(b => b.category === opts.category);
  if (opts.search) { const q = opts.search.toLowerCase(); all = all.filter(b => b.title.toLowerCase().includes(q) || b.excerpt.toLowerCase().includes(q)); }
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const total = all.length;
  const p = opts.page ?? 1; const l = opts.limit ?? 20;
  return { data: all.slice((p - 1) * l, p * l), total };
}

export function upsertBlog(data: Partial<BlogPost> & { id?: string }): BlogPost {
  const all = readJsonl<BlogPost>(FILES.blog);
  const idx = data.id ? all.findIndex(b => b.id === data.id) : -1;
  if (idx >= 0) {
    if (data.status === 'published' && !all[idx].publishedAt) data.publishedAt = new Date().toISOString();
    all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
    writeJsonl(FILES.blog, all);
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
  appendJsonl(FILES.blog, post);
  return post;
}

export function deleteBlog(id: string): boolean {
  const all = readJsonl<BlogPost>(FILES.blog);
  const next = all.filter(b => b.id !== id);
  if (next.length === all.length) return false;
  writeJsonl(FILES.blog, next);
  return true;
}
