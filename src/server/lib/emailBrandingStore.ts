/**
 * Persistent, environment-aware branding for every transactional email.
 *
 * Environment variables provide safe deployment defaults. Admin changes are
 * stored in PostgreSQL and overlaid on those defaults so they survive deploys.
 */
import { eq } from 'drizzle-orm';
import { getSecret } from '#runtime/secrets';
import { DEFAULT_BUSINESS_ADDRESS, normalizeBusinessAddress } from '../../lib/businessLocation.js';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { config as configTable } from '../db/schema.js';

const CONFIG_KEY = 'email_branding';
const UNVERIFIED_POSTAL_ADDRESS = 'Business address pending verification';

export interface EmailBrandingConfig {
  brandName: string;
  logoUrl: string;
  websiteUrl: string;
  websiteButtonLabel: string;
  supportEmail: string;
  supportPhone: string;
  postalAddress: string;
  primaryColor: string;
  footerMessage: string;
  updatedAt: string;
  updatedBy: string;
}

function env(name: string, fallback: string): string {
  const secret = getSecret(name);
  if (typeof secret === 'string' && secret.trim()) return secret.trim();
  return process.env[name]?.trim() || fallback;
}

function safePostalAddress(value: string): string {
  const normalized = normalizeBusinessAddress(value);
  return normalized === DEFAULT_BUSINESS_ADDRESS ? UNVERIFIED_POSTAL_ADDRESS : normalized;
}

function environmentDefaults(): EmailBrandingConfig {
  return {
    brandName: env('EMAIL_BRAND_NAME', 'City Gate Capital'),
    logoUrl: env('EMAIL_LOGO_URL', 'https://citygate.capital/assets/brand/city-gate-capital-horizontal.png'),
    websiteUrl: env('EMAIL_WEBSITE_URL', 'https://citygate.capital'),
    websiteButtonLabel: env('EMAIL_WEBSITE_BUTTON_LABEL', 'Open City Gate Capital'),
    supportEmail: env('EMAIL_SUPPORT_ADDRESS', 'support@citygate.capital'),
    supportPhone: env('EMAIL_SUPPORT_PHONE', '+44 7888 382458'),
    postalAddress: safePostalAddress(env('EMAIL_POSTAL_ADDRESS', UNVERIFIED_POSTAL_ADDRESS)),
    primaryColor: env('EMAIL_PRIMARY_COLOR', '#C9A84C'),
    footerMessage: env('EMAIL_FOOTER_MESSAGE', 'Secure access to your City Gate Capital account and services.'),
    updatedAt: new Date().toISOString(),
    updatedBy: 'environment',
  };
}

let cache: Partial<EmailBrandingConfig> | null = null;

export function loadEmailBranding(): EmailBrandingConfig {
  const branding = { ...environmentDefaults(), ...(cache ?? {}) };
  return { ...branding, postalAddress: safePostalAddress(branding.postalAddress) };
}

function normalizeUrl(value: string, field: string): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error(`${field} must be a valid absolute URL.`); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${field} must use http or https.`);
  }
  return parsed.toString().replace(/\/$/, '');
}

function normalizeColor(value: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Primary color must be a six-digit hex color.');
  return value.toUpperCase();
}

export function saveEmailBranding(
  patch: Partial<EmailBrandingConfig>,
  updatedBy = 'admin',
): EmailBrandingConfig {
  const current = loadEmailBranding();
  const next: EmailBrandingConfig = {
    ...current,
    ...patch,
    brandName: String(patch.brandName ?? current.brandName).trim().slice(0, 100),
    logoUrl: normalizeUrl(String(patch.logoUrl ?? current.logoUrl).trim(), 'Logo URL'),
    websiteUrl: normalizeUrl(String(patch.websiteUrl ?? current.websiteUrl).trim(), 'Website URL'),
    websiteButtonLabel: String(patch.websiteButtonLabel ?? current.websiteButtonLabel).trim().slice(0, 80),
    supportEmail: String(patch.supportEmail ?? current.supportEmail).trim().toLowerCase().slice(0, 254),
    supportPhone: String(patch.supportPhone ?? current.supportPhone).trim().slice(0, 50),
    postalAddress: String(patch.postalAddress ?? current.postalAddress).trim().slice(0, 240),
    primaryColor: normalizeColor(String(patch.primaryColor ?? current.primaryColor).trim()),
    footerMessage: String(patch.footerMessage ?? current.footerMessage).trim().slice(0, 500),
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  if (!next.brandName) throw new Error('Brand name is required.');
  if (!next.websiteButtonLabel) throw new Error('Website button label is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.supportEmail)) throw new Error('Support email is invalid.');

  cache = next;
  persist(next).catch(error => console.error(JSON.stringify({ event: 'emailBranding.write.failed', error: String(error) })));
  return { ...next };
}

async function persist(value: EmailBrandingConfig): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db.insert(configTable)
    .values({ key: CONFIG_KEY, value: value as unknown as Record<string, unknown>, updatedBy: value.updatedBy })
    .onConflictDoUpdate({
      target: configTable.key,
      set: { value: value as unknown as Record<string, unknown>, updatedAt: new Date(), updatedBy: value.updatedBy },
    });
}

export async function loadEmailBrandingFromDb(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const rows = await getDb().select().from(configTable).where(eq(configTable.key, CONFIG_KEY)).limit(1);
    if (rows.length) cache = rows[0].value as Partial<EmailBrandingConfig>;
  } catch (error) {
    console.warn(JSON.stringify({ event: 'emailBranding.load.skipped', error: String(error) }));
  }
}
