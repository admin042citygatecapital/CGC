/**
 * configStore.ts
 * PostgreSQL-backed store for the Admin Configuration Center.
 * Config is stored in the `config` table under key 'app_config'.
 * Falls back to defaultConfig() when DATABASE_URL is not set.
 */
import { eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { config as configTable } from '../db/schema.js';

const CONFIG_KEY = 'app_config';

// ── In-memory write-through cache ─────────────────────────────────────────────
let _cache: AppConfig | null = null;

function readConfig(): AppConfig {
  if (_cache) return _cache;
  return defaultConfig();
}

function writeConfig(cfg: AppConfig): void {
  _cache = cfg;
  persistConfig(cfg).catch(err =>
    console.error(JSON.stringify({ event: 'configStore.write.failed', error: String(err) }))
  );
}

async function persistConfig(cfg: AppConfig): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db.insert(configTable)
    .values({ key: CONFIG_KEY, value: cfg as unknown as Record<string, unknown>, updatedBy: 'admin' })
    .onConflictDoUpdate({ target: configTable.key, set: { value: cfg as unknown as Record<string, unknown>, updatedAt: new Date() } });
}

/** Load config from DB into cache. Call once at server startup. */
export async function loadConfigFromDb(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const db   = getDb();
    const rows = await db.select().from(configTable).where(eq(configTable.key, CONFIG_KEY));
    if (rows.length) {
      _cache = { ...defaultConfig(), ...(rows[0].value as Partial<AppConfig>) };
    }
  } catch { /* use defaults */ }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrandingConfig {
  appName:          string;
  tagline:          string;
  supportEmail:     string;
  supportPhone:     string;
  websiteUrl:       string;
  primaryColor:     string;
  accentColor:      string;
  logoUrl:          string;
  faviconUrl:       string;
  footerText:       string;
}

export interface ThemeConfig {
  mode:             'dark' | 'light' | 'system';
  fontFamily:       string;
  borderRadius:     'none' | 'sm' | 'md' | 'lg' | 'xl';
  density:          'compact' | 'comfortable' | 'spacious';
  animationsEnabled: boolean;
  sidebarCollapsed: boolean;
}

export interface HomepageConfig {
  heroTitle:        string;
  heroSubtitle:     string;
  heroCtaLabel:     string;
  heroCtaUrl:       string;
  heroSecondaryCtaLabel: string;
  heroSecondaryCtaUrl:   string;
  showStats:        boolean;
  showTestimonials: boolean;
  showPartners:     boolean;
  showNewsSection:  boolean;
  announcementBannerEnabled: boolean;
  announcementBannerText:    string;
  announcementBannerType:    'info' | 'warning' | 'success' | 'maintenance';
}

export interface DashboardWidgetsConfig {
  showBalanceWidget:      boolean;
  showTransactionFeed:    boolean;
  showSpendingChart:      boolean;
  showCurrencyRates:      boolean;
  showQuickTransfer:      boolean;
  showCardWidget:         boolean;
  showNotificationsPanel: boolean;
  showMarketData:         boolean;
  defaultCurrency:        string;
  transactionFeedLimit:   number;
}

export interface NotificationSettingsConfig {
  emailNotificationsEnabled:  boolean;
  smsNotificationsEnabled:    boolean;
  pushNotificationsEnabled:   boolean;
  loginAlertEmail:            boolean;
  loginAlertSms:              boolean;
  transactionAlertEmail:      boolean;
  transactionAlertSms:        boolean;
  kycStatusEmail:             boolean;
  marketingEmailsEnabled:     boolean;
  digestFrequency:            'realtime' | 'hourly' | 'daily' | 'weekly';
}

export interface MaintenanceModeConfig {
  enabled:          boolean;
  message:          string;
  estimatedEndTime: string;
  allowAdminAccess: boolean;
  allowedIPs:       string[];
  showCountdown:    boolean;
}

export interface FeatureTogglesConfig {
  virtualCardsEnabled:       boolean;
  cryptoWalletEnabled:       boolean;
  p2pTransfersEnabled:       boolean;
  internationalTransfers:    boolean;
  savingsAccountEnabled:     boolean;
  loanApplicationEnabled:    boolean;
  referralProgramEnabled:    boolean;
  twoFactorRequired:         boolean;
  biometricLoginEnabled:     boolean;
  darkModeEnabled:           boolean;
  chatSupportEnabled:        boolean;
  kycRequiredForTransfers:   boolean;
  maxDailyTransferLimit:     number;
  maxSingleTransferLimit:    number;
}

export interface ExchangeRateConfig {
  baseCurrency:         string;
  updateIntervalMins:   number;
  markupPercent:        number;
  provider:             'manual' | 'openexchangerates' | 'fixer' | 'exchangerate-api';
  apiKey:               string;
  roundingDecimalPlaces: number;
  displayedCurrencies:  string[];
  autoUpdateEnabled:    boolean;
}

export interface LanguageConfig {
  defaultLocale:    string;
  supportedLocales: string[];
  rtlEnabled:       boolean;
  dateFormat:       string;
  timeFormat:       '12h' | '24h';
  numberFormat:     'en-US' | 'en-GB' | 'de-DE' | 'fr-FR';
}

export interface CurrencyConfig {
  defaultCurrency:    string;
  supportedCurrencies: string[];
  currencyPosition:   'before' | 'after';
  thousandsSeparator: ',' | '.' | ' ';
  decimalSeparator:   '.' | ',';
  showCurrencyCode:   boolean;
}

export interface TimezoneConfig {
  defaultTimezone:    string;
  displayTimezone:    string;
  useUserTimezone:    boolean;
  businessHoursStart: string;
  businessHoursEnd:   string;
  businessDays:       number[];
}

export interface AppConfig {
  branding:           BrandingConfig;
  theme:              ThemeConfig;
  homepage:           HomepageConfig;
  dashboardWidgets:   DashboardWidgetsConfig;
  notificationSettings: NotificationSettingsConfig;
  maintenanceMode:    MaintenanceModeConfig;
  featureToggles:     FeatureTogglesConfig;
  exchangeRates:      ExchangeRateConfig;
  language:           LanguageConfig;
  currency:           CurrencyConfig;
  timezone:           TimezoneConfig;
  updatedAt:          string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

function defaultConfig(): AppConfig {
  return {
    branding: {
      appName:      'City Gate Capital',
      tagline:      'The Future of Banking is Here',
      supportEmail: 'support@citygate.capital',
      supportPhone: '+1 (800) CGC-BANK',
      websiteUrl:   'https://citygate.capital',
      primaryColor: '#C9A84C',
      accentColor:  '#F0D080',
      logoUrl:      '',
      faviconUrl:   '',
      footerText:   '© 2026 City Gate Capital. All rights reserved.',
    },
    theme: {
      mode:              'dark',
      fontFamily:        'Inter',
      borderRadius:      'lg',
      density:           'comfortable',
      animationsEnabled: true,
      sidebarCollapsed:  false,
    },
    homepage: {
      heroTitle:                 'The Future of Banking is Here',
      heroSubtitle:              'Experience next-generation digital banking with City Gate Capital.',
      heroCtaLabel:              'Open Account',
      heroCtaUrl:                '/register',
      heroSecondaryCtaLabel:     'Learn More',
      heroSecondaryCtaUrl:       '#features',
      showStats:                 true,
      showTestimonials:          true,
      showPartners:              true,
      showNewsSection:           true,
      announcementBannerEnabled: false,
      announcementBannerText:    '',
      announcementBannerType:    'info',
    },
    dashboardWidgets: {
      showBalanceWidget:      true,
      showTransactionFeed:    true,
      showSpendingChart:      true,
      showCurrencyRates:      true,
      showQuickTransfer:      true,
      showCardWidget:         true,
      showNotificationsPanel: true,
      showMarketData:         false,
      defaultCurrency:        'USD',
      transactionFeedLimit:   10,
    },
    notificationSettings: {
      emailNotificationsEnabled: true,
      smsNotificationsEnabled:   false,
      pushNotificationsEnabled:  false,
      loginAlertEmail:           true,
      loginAlertSms:             false,
      transactionAlertEmail:     true,
      transactionAlertSms:       false,
      kycStatusEmail:            true,
      marketingEmailsEnabled:    false,
      digestFrequency:           'realtime',
    },
    maintenanceMode: {
      enabled:          false,
      message:          'We are currently performing scheduled maintenance. We will be back shortly.',
      estimatedEndTime: '',
      allowAdminAccess: true,
      allowedIPs:       [],
      showCountdown:    false,
    },
    featureToggles: {
      virtualCardsEnabled:     true,
      cryptoWalletEnabled:     false,
      p2pTransfersEnabled:     true,
      internationalTransfers:  true,
      savingsAccountEnabled:   true,
      loanApplicationEnabled:  false,
      referralProgramEnabled:  false,
      twoFactorRequired:       false,
      biometricLoginEnabled:   false,
      darkModeEnabled:         true,
      chatSupportEnabled:      true,
      kycRequiredForTransfers: true,
      maxDailyTransferLimit:   50000,
      maxSingleTransferLimit:  10000,
    },
    exchangeRates: {
      baseCurrency:          'USD',
      updateIntervalMins:    60,
      markupPercent:         1.5,
      provider:              'manual',
      apiKey:                '',
      roundingDecimalPlaces: 4,
      displayedCurrencies:   ['USD','EUR','GBP','NGN','GHS','KES','ZAR'],
      autoUpdateEnabled:     false,
    },
    language: {
      defaultLocale:    'en-US',
      supportedLocales: ['en-US','en-GB','fr-FR','de-DE'],
      rtlEnabled:       false,
      dateFormat:       'DD/MM/YYYY',
      timeFormat:       '24h',
      numberFormat:     'en-US',
    },
    currency: {
      defaultCurrency:     'USD',
      supportedCurrencies: ['USD','EUR','GBP','NGN','GHS','KES','ZAR','CAD','AUD'],
      currencyPosition:    'before',
      thousandsSeparator:  ',',
      decimalSeparator:    '.',
      showCurrencyCode:    false,
    },
    timezone: {
      defaultTimezone:    'Africa/Lagos',
      displayTimezone:    'Africa/Lagos',
      useUserTimezone:    true,
      businessHoursStart: '09:00',
      businessHoursEnd:   '17:00',
      businessDays:       [1, 2, 3, 4, 5],
    },
    updatedAt: new Date().toISOString(),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Exported so the homepage POST handler can call reset without re-importing defaultConfig */
export function defaultHomepageConfig(): HomepageConfig {
  return defaultConfig().homepage;
}

export function getConfig(): AppConfig {
  return readConfig();
}

export function getSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
  return readConfig()[section];
}

export function updateSection<K extends keyof Omit<AppConfig, 'updatedAt'>>(
  section: K,
  patch: Partial<AppConfig[K]>
): AppConfig {
  const cfg = readConfig();
  (cfg as any)[section] = { ...(cfg as any)[section], ...patch };
  cfg.updatedAt = new Date().toISOString();
  writeConfig(cfg);
  return cfg;
}

export function resetSection<K extends keyof Omit<AppConfig, 'updatedAt'>>(section: K): AppConfig {
  const cfg     = readConfig();
  const def     = defaultConfig();
  (cfg as any)[section] = (def as any)[section];
  cfg.updatedAt = new Date().toISOString();
  writeConfig(cfg);
  return cfg;
}
