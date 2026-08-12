/**
 * integrationStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent flat-file store for the Integrations Center.
 * Stores per-integration config overrides, last-sync timestamps, and
 * admin-supplied notes. Actual credentials always come from getSecret().
 *
 * File: /private/config/integrations.json
 */

import fs   from 'node:fs';
import path from 'node:path';
import { getSecret } from '#runtime/secrets';
import { privateSubdirectory } from './storagePaths.js';

const DIR  = privateSubdirectory('config');
const FILE = path.join(DIR, 'integrations.json');

// ─── Integration IDs ──────────────────────────────────────────────────────────

export type IntegrationId =
  | 'resend'
  | 'zoho_mail'
  | 'smartsupp'
  | 'cloudflare'
  | 'google_analytics'
  | 'google_tag_manager'
  | 'google_maps'
  | 'stripe'
  | 'paypal'
  | 'twilio'
  | 'whatsapp_business'
  | 'banking_api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntegrationRecord {
  id:          IntegrationId;
  enabled:     boolean;
  notes:       string;
  lastTestedAt: string | null;
  lastSyncAt:   string | null;
  /** Admin-supplied config overrides (non-secret, e.g. webhook URLs, region) */
  config:      Record<string, string>;
}

export type IntegrationStore = Record<IntegrationId, IntegrationRecord>;

// ─── Defaults ─────────────────────────────────────────────────────────────────

function defaultRecord(id: IntegrationId): IntegrationRecord {
  return { id, enabled: false, notes: '', lastTestedAt: null, lastSyncAt: null, config: {} };
}

const ALL_IDS: IntegrationId[] = [
  'resend', 'zoho_mail', 'smartsupp', 'cloudflare', 'google_analytics',
  'google_tag_manager', 'google_maps', 'stripe', 'paypal',
  'twilio', 'whatsapp_business', 'banking_api',
];

function defaultStore(): IntegrationStore {
  return Object.fromEntries(ALL_IDS.map(id => [id, defaultRecord(id)])) as IntegrationStore;
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
}

function readStore(): IntegrationStore {
  try {
    ensureDir();
    if (!fs.existsSync(FILE)) return defaultStore();
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    // Merge with defaults so new integrations added later are always present
    const def = defaultStore();
    for (const id of ALL_IDS) {
      if (!raw[id]) raw[id] = def[id];
    }
    return raw as IntegrationStore;
  } catch {
    return defaultStore();
  }
}

function writeStore(store: IntegrationStore): void {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2) + '\n');
}

// ─── Secret resolution ────────────────────────────────────────────────────────

/** Returns true if at least one of the given secret names has a non-empty value */
function hasSecret(...names: string[]): boolean {
  return names.some(n => {
    const v = getSecret(n);
    return v && String(v).trim().length > 0;
  });
}

// ─── Connection status ────────────────────────────────────────────────────────

export type ConnectionStatus = 'connected' | 'disconnected' | 'partial' | 'unknown';

export interface IntegrationStatus {
  id:             IntegrationId;
  name:           string;
  category:       string;
  description:    string;
  docsUrl:        string;
  status:         ConnectionStatus;
  enabled:        boolean;
  notes:          string;
  lastTestedAt:   string | null;
  lastSyncAt:     string | null;
  config:         Record<string, string>;
  /** Which secrets are required and whether each is present */
  secrets:        { name: string; label: string; present: boolean; required: boolean }[];
  /** Non-secret config fields the admin can fill in */
  configFields:   { key: string; label: string; placeholder: string; hint?: string }[];
}

// ─── Integration metadata ─────────────────────────────────────────────────────

interface IntegrationMeta {
  name:         string;
  category:     string;
  description:  string;
  docsUrl:      string;
  secretSpecs:  { name: string; label: string; required: boolean }[];
  configFields: { key: string; label: string; placeholder: string; hint?: string }[];
}

const META: Record<IntegrationId, IntegrationMeta> = {
  resend: {
    name:        'Resend',
    category:    'Email',
    description: 'Primary transactional email delivery for verification, security, KYC and service notifications.',
    docsUrl:     'https://resend.com/docs',
    secretSpecs: [
      { name: 'RESEND_API_KEY',        label: 'API Key',        required: true  },
      { name: 'RESEND_WEBHOOK_SECRET', label: 'Webhook Secret', required: true  },
    ],
    configFields: [
      { key: 'fromEmail', label: 'From Email', placeholder: 'noreply@citygate.capital' },
      { key: 'fromName',  label: 'From Name',  placeholder: 'City Gate Capital' },
      { key: 'replyTo',   label: 'Reply-To',   placeholder: 'support@citygate.capital' },
    ],
  },
  zoho_mail: {
    name:        'Zoho Mail',
    category:    'Email',
    description: 'Business mailbox and OAuth delivery fallback. Resend remains the primary transactional provider.',
    docsUrl:     'https://www.zoho.com/mail/help/api/',
    secretSpecs: [
      { name: 'ZOHO_CLIENT_ID',     label: 'Client ID',     required: true  },
      { name: 'ZOHO_CLIENT_SECRET', label: 'Client Secret', required: true  },
      { name: 'ZOHO_REFRESH_TOKEN', label: 'Refresh Token', required: true  },
      { name: 'ZOHO_ACCOUNT_ID',    label: 'Account ID',    required: false },
    ],
    configFields: [
      { key: 'fromEmail',  label: 'From Email',  placeholder: 'noreply@citygate.capital' },
      { key: 'fromName',   label: 'From Name',   placeholder: 'City Gate Capital' },
      { key: 'replyTo',    label: 'Reply-To',    placeholder: 'support@citygate.capital' },
    ],
  },
  smartsupp: {
    name:        'Smartsupp',
    category:    'Live Chat',
    description: 'Live chat widget and visitor tracking. Embedded on the customer-facing site for real-time support.',
    docsUrl:     'https://docs.smartsupp.com/',
    secretSpecs: [
      { name: 'SMARTSUPP_KEY',        label: 'Widget Key',  required: true  },
      { name: 'SMARTSUPP_API_KEY',    label: 'API Key',     required: false },
    ],
    configFields: [
      { key: 'widgetColor', label: 'Widget Color', placeholder: '#C9A84C', hint: 'Hex color for the chat bubble' },
      { key: 'position',    label: 'Position',     placeholder: 'bottom-right' },
    ],
  },
  cloudflare: {
    name:        'Cloudflare',
    category:    'Security / CDN',
    description: 'CDN, DDoS protection, and DNS management. Provides WAF rules and edge caching for the platform.',
    docsUrl:     'https://developers.cloudflare.com/',
    secretSpecs: [
      { name: 'CLOUDFLARE_API_TOKEN', label: 'API Token',  required: true  },
      { name: 'CLOUDFLARE_ZONE_ID',   label: 'Zone ID',    required: true  },
      { name: 'CLOUDFLARE_ACCOUNT_ID',label: 'Account ID', required: false },
    ],
    configFields: [
      { key: 'zoneId',    label: 'Zone ID',    placeholder: 'abc123…', hint: 'Found in Cloudflare dashboard → Overview' },
      { key: 'proxyMode', label: 'Proxy Mode', placeholder: 'full' },
    ],
  },
  google_analytics: {
    name:        'Google Analytics',
    category:    'Analytics',
    description: 'GA4 property for tracking page views, events, and conversion funnels across the customer portal.',
    docsUrl:     'https://developers.google.com/analytics',
    secretSpecs: [
      { name: 'GA_MEASUREMENT_ID',  label: 'Measurement ID', required: true  },
      { name: 'GA_API_SECRET',      label: 'API Secret',     required: false },
    ],
    configFields: [
      { key: 'measurementId', label: 'Measurement ID', placeholder: 'G-XXXXXXXXXX' },
      { key: 'streamId',      label: 'Data Stream ID', placeholder: '1234567890' },
    ],
  },
  google_tag_manager: {
    name:        'Google Tag Manager',
    category:    'Analytics',
    description: 'Tag management container for deploying marketing pixels, analytics, and custom scripts without code deploys.',
    docsUrl:     'https://developers.google.com/tag-platform/tag-manager',
    secretSpecs: [
      { name: 'GTM_CONTAINER_ID', label: 'Container ID', required: true },
    ],
    configFields: [
      { key: 'containerId', label: 'Container ID', placeholder: 'GTM-XXXXXXX' },
      { key: 'environment', label: 'Environment',  placeholder: 'live', hint: 'live, staging, or custom env name' },
    ],
  },
  google_maps: {
    name:        'Google Maps',
    category:    'Maps',
    description: 'Embed maps for branch locator, ATM finder, and address autocomplete in the onboarding flow.',
    docsUrl:     'https://developers.google.com/maps',
    secretSpecs: [
      { name: 'GOOGLE_MAPS_API_KEY', label: 'API Key', required: true },
    ],
    configFields: [
      { key: 'defaultLat',  label: 'Default Latitude',  placeholder: '6.5244' },
      { key: 'defaultLng',  label: 'Default Longitude', placeholder: '3.3792' },
      { key: 'defaultZoom', label: 'Default Zoom',      placeholder: '13' },
    ],
  },
  stripe: {
    name:        'Stripe',
    category:    'Payments',
    description: 'Card processing, subscription billing, and payout management for premium account tiers.',
    docsUrl:     'https://stripe.com/docs',
    secretSpecs: [
      { name: 'STRIPE_SECRET_KEY',      label: 'Secret Key',       required: true  },
      { name: 'STRIPE_PUBLISHABLE_KEY', label: 'Publishable Key',  required: true  },
      { name: 'STRIPE_WEBHOOK_SECRET',  label: 'Webhook Secret',   required: false },
    ],
    configFields: [
      { key: 'webhookUrl',  label: 'Webhook Endpoint', placeholder: 'https://citygate.capital/api/stripe/webhook' },
      { key: 'currency',    label: 'Default Currency', placeholder: 'usd' },
    ],
  },
  paypal: {
    name:        'PayPal',
    category:    'Payments',
    description: 'PayPal checkout and payout rails for customers who prefer PayPal over card payments.',
    docsUrl:     'https://developer.paypal.com/',
    secretSpecs: [
      { name: 'PAYPAL_CLIENT_ID',     label: 'Client ID',     required: true  },
      { name: 'PAYPAL_CLIENT_SECRET', label: 'Client Secret', required: true  },
    ],
    configFields: [
      { key: 'mode',       label: 'Mode',       placeholder: 'sandbox', hint: 'sandbox or live' },
      { key: 'currency',   label: 'Currency',   placeholder: 'USD' },
    ],
  },
  twilio: {
    name:        'Twilio',
    category:    'SMS / Voice',
    description: 'SMS OTP delivery, transaction alerts, and voice verification for high-value transfers.',
    docsUrl:     'https://www.twilio.com/docs',
    secretSpecs: [
      { name: 'TWILIO_ACCOUNT_SID', label: 'Account SID', required: true  },
      { name: 'TWILIO_AUTH_TOKEN',  label: 'Auth Token',  required: true  },
      { name: 'TWILIO_VERIFY_SID',  label: 'Verify SID',  required: false },
    ],
    configFields: [
      { key: 'fromNumber',  label: 'From Number',  placeholder: '+1234567890' },
      { key: 'messagingServiceSid', label: 'Messaging Service SID', placeholder: 'MGxxxxxxxx' },
    ],
  },
  whatsapp_business: {
    name:        'WhatsApp Business',
    category:    'Messaging',
    description: 'WhatsApp Business API for transactional notifications, KYC status updates, and customer support.',
    docsUrl:     'https://developers.facebook.com/docs/whatsapp',
    secretSpecs: [
      { name: 'WHATSAPP_TOKEN',       label: 'Access Token',    required: true  },
      { name: 'WHATSAPP_PHONE_ID',    label: 'Phone Number ID', required: true  },
      { name: 'WHATSAPP_VERIFY_TOKEN',label: 'Verify Token',    required: false },
    ],
    configFields: [
      { key: 'businessAccountId', label: 'Business Account ID', placeholder: '123456789' },
      { key: 'webhookUrl',        label: 'Webhook URL',         placeholder: 'https://citygate.capital/api/whatsapp/webhook' },
    ],
  },
  banking_api: {
    name:        'Banking APIs',
    category:    'Core Banking',
    description: 'Third-party banking rails — Flutterwave, Paystack, or direct NIBSS/SWIFT connectivity for NGN and international transfers.',
    docsUrl:     'https://developer.flutterwave.com/',
    secretSpecs: [
      { name: 'FLUTTERWAVE_SECRET_KEY',  label: 'Flutterwave Secret',  required: false },
      { name: 'PAYSTACK_SECRET_KEY',     label: 'Paystack Secret',     required: false },
      { name: 'BANKING_API_KEY',         label: 'Banking API Key',     required: false },
    ],
    configFields: [
      { key: 'provider',    label: 'Primary Provider', placeholder: 'flutterwave', hint: 'flutterwave, paystack, or custom' },
      { key: 'baseUrl',     label: 'API Base URL',     placeholder: 'https://api.flutterwave.com/v3' },
      { key: 'environment', label: 'Environment',      placeholder: 'sandbox', hint: 'sandbox or live' },
    ],
  },
};

// ─── Derive connection status from secrets ────────────────────────────────────

function deriveStatus(id: IntegrationId, _record: IntegrationRecord): ConnectionStatus {
  const specs = META[id].secretSpecs;
  const required = specs.filter(s => s.required);
  const optional = specs.filter(s => !s.required);
  const requiredPresent = required.every(s => hasSecret(s.name));
  const optionalPresent = optional.some(s => hasSecret(s.name));
  if (required.length === 0 && optional.length === 0) return 'unknown';
  if (required.length === 0) return optionalPresent ? 'connected' : 'disconnected';
  if (requiredPresent) return 'connected';
  if (optionalPresent || required.some(s => hasSecret(s.name))) return 'partial';
  return 'disconnected';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getAllIntegrations(): IntegrationStatus[] {
  const store = readStore();
  return ALL_IDS.map(id => {
    const record = store[id];
    const meta   = META[id];
    const status = deriveStatus(id, record);
    return {
      id,
      name:        meta.name,
      category:    meta.category,
      description: meta.description,
      docsUrl:     meta.docsUrl,
      status,
      enabled:     record.enabled,
      notes:       record.notes,
      lastTestedAt: record.lastTestedAt,
      lastSyncAt:   record.lastSyncAt,
      config:      record.config,
      secrets:     meta.secretSpecs.map(s => ({
        name:     s.name,
        label:    s.label,
        present:  hasSecret(s.name),
        required: s.required,
      })),
      configFields: meta.configFields,
    };
  });
}

export function getIntegration(id: IntegrationId): IntegrationStatus | null {
  const all = getAllIntegrations();
  return all.find(i => i.id === id) ?? null;
}

export function updateIntegration(
  id: IntegrationId,
  patch: { enabled?: boolean; notes?: string; config?: Record<string, string> }
): IntegrationStatus {
  const store = readStore();
  const rec   = store[id] ?? defaultRecord(id);
  if (patch.enabled  !== undefined) rec.enabled = patch.enabled;
  if (patch.notes    !== undefined) rec.notes   = patch.notes;
  if (patch.config   !== undefined) rec.config  = { ...rec.config, ...patch.config };
  store[id] = rec;
  writeStore(store);
  return getIntegration(id)!;
}

export function recordTestResult(id: IntegrationId, success: boolean): void {
  const store = readStore();
  const rec   = store[id] ?? defaultRecord(id);
  rec.lastTestedAt = new Date().toISOString();
  if (success) rec.lastSyncAt = new Date().toISOString();
  store[id] = rec;
  writeStore(store);
}
