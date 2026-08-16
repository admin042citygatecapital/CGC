/**
 * emailTemplateStore.ts
 * Persistent store for admin-editable system email templates.
 * Stored in /private/email/templates.json
 *
 * Supports 10 system templates + variable substitution.
 * Transactional templates (KYC, transfer, etc.) are always sent regardless
 * of newsletter subscription status.
 */
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { config as configTable } from '../db/schema.js';
import { privateSubdirectory } from './storagePaths.js';

const DATA_DIR  = privateSubdirectory('email');
const DATA_FILE = path.join(DATA_DIR, 'templates.json');
const CONFIG_KEY = 'email_templates';

export type TemplateId =
  | 'welcome'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'deposit_confirmed'
  | 'withdrawal_approved'
  | 'transfer_sent'
  | 'transfer_received'
  | 'password_reset'
  | 'two_fa_code'
  | 'security_alert';

export interface EmailTemplate {
  id: TemplateId;
  name: string;
  description: string;
  subject: string;
  body: string;           // HTML body with {variable} placeholders
  variables: string[];    // documented variables for this template
  category: 'auth' | 'kyc' | 'transaction' | 'security' | 'account';
  updatedAt: string;
  updatedBy: string;
}

// ── Default templates ─────────────────────────────────────────────────────────

const DEFAULTS: EmailTemplate[] = [
  {
    id: 'welcome',
    name: 'Welcome Email',
    description: 'Sent immediately after a new customer profile is registered.',
    category: 'account',
    variables: ['{user_name}', '{email}', '{date}', '{account_number}'],
    subject: 'Welcome to City Gate Capital, {user_name}!',
    body: `<p>Dear {user_name},</p>
<p>Welcome to <strong>City Gate Capital</strong>. Your profile has been created successfully and your registration workflow is ready to continue.</p>
<p><strong>Profile Details:</strong><br/>
Email: {email}<br/>
Account Number: {account_number}<br/>
Date Joined: {date}</p>
<p>Financial services activate only after identity verification, eligibility review, and the availability of an approved provider for the relevant product. Upload identity information only through the secure onboarding workflow when requested.</p>
<p>If you have a question, contact support@citygate.capital. No response-time guarantee is offered.</p>
<p>Best regards,<br/>The City Gate Capital Team</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'kyc_approved',
    name: 'Identity Review Updated',
    description: 'Notification for an internal identity-review workflow update.',
    category: 'kyc',
    variables: ['{user_name}', '{date}', '{account_number}'],
    subject: 'Identity Review Updated — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>Your City Gate Capital identity-review record has been updated.</p>
<p>This notice does not by itself activate banking, payments, cards, trading, custody, or other financial services. Product access remains subject to provider verification, eligibility, and applicable approvals.</p>
<p>Review Date: {date}</p>
<p>Best regards,<br/>The City Gate Capital Team</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'kyc_rejected',
    name: 'Identity Review Needs Information',
    description: 'Notification requesting additional information for identity review.',
    category: 'kyc',
    variables: ['{user_name}', '{rejection_reason}', '{date}'],
    subject: 'Identity Review Needs Information — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>Your identity-review workflow needs additional information.</p>
<p><strong>Reviewer note:</strong> {rejection_reason}</p>
<p>Submit information only through the secure onboarding workflow. This notice does not by itself activate a financial service.</p>
<p>Best regards,<br/>The City Gate Capital Team</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'deposit_confirmed',
    name: 'Funding Record Updated',
    description: 'Notification for an internal funding record that does not represent settled funds.',
    category: 'transaction',
    variables: ['{user_name}', '{amount}', '{currency}', '{date}', '{transaction_id}', '{account_number}'],
    subject: 'Funding Record Updated: {amount} {currency} — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>An internal funding record was created. No money was received or credited.</p>
<p><strong>Account Record:</strong><br/>
Amount: {amount} {currency}<br/>
Transaction ID: {transaction_id}<br/>
Account: {account_number}<br/>
Date: {date}</p>
<p>The displayed amount does not represent settled customer funds and has no monetary value.</p>
<p>Best regards,<br/>City Gate Capital</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'withdrawal_approved',
    name: 'Withdrawal Record Updated',
    description: 'Notification for an internal withdrawal record that does not represent processed funds.',
    category: 'transaction',
    variables: ['{user_name}', '{amount}', '{currency}', '{date}', '{transaction_id}'],
    subject: 'Withdrawal Record Updated: {amount} {currency} — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>An internal withdrawal record was updated. No withdrawal was approved or processed.</p>
<p><strong>Account Record:</strong><br/>
Amount: {amount} {currency}<br/>
Transaction ID: {transaction_id}<br/>
Date: {date}</p>
<p>No funds will arrive because no approved payment provider executed this record.</p>
<p>Best regards,<br/>City Gate Capital</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'transfer_sent',
    name: 'Transfer Record Created',
    description: 'Notification for an internal outgoing transfer record.',
    category: 'transaction',
    variables: ['{user_name}', '{amount}', '{currency}', '{recipient_name}', '{date}', '{transaction_id}'],
    subject: 'Transfer Record Created: {amount} {currency} — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>An internal transfer record was created. No funds or assets were sent by an external provider.</p>
<p><strong>Transfer Record:</strong><br/>
Amount: {amount} {currency}<br/>
Recipient: {recipient_name}<br/>
Transaction ID: {transaction_id}<br/>
Date: {date}</p>
<p>Best regards,<br/>City Gate Capital</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'transfer_received',
    name: 'Incoming Transfer Record Created',
    description: 'Notification for an internal incoming transfer record.',
    category: 'transaction',
    variables: ['{user_name}', '{amount}', '{currency}', '{sender_name}', '{date}', '{transaction_id}'],
    subject: 'Incoming Transfer Record: {amount} {currency} — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>An internal incoming-transfer record was created. You did not receive settled funds or assets from an external provider.</p>
<p><strong>Transfer Record:</strong><br/>
Amount: {amount} {currency}<br/>
From: {sender_name}<br/>
Transaction ID: {transaction_id}<br/>
Date: {date}</p>
<p>Best regards,<br/>City Gate Capital</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'password_reset',
    name: 'Password Reset',
    description: 'Sent when a user requests a password reset.',
    category: 'auth',
    variables: ['{user_name}', '{reset_link}', '{expiry_time}', '{date}'],
    subject: 'Reset Your Password — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>We received a request to reset your City Gate Capital account password.</p>
<p>Click the link below to reset your password. This link expires in {expiry_time}.</p>
<p><a href="{reset_link}" style="background:#C9A84C;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Reset Password</a></p>
<p>If you did not request this, please ignore this email. Your password will not change.</p>
<p>Request Date: {date}</p>
<p>Best regards,<br/>City Gate Capital Security Team</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'two_fa_code',
    name: '2FA Code',
    description: 'Sent when a user requests a two-factor authentication code.',
    category: 'auth',
    variables: ['{user_name}', '{otp_code}', '{expiry_time}', '{date}'],
    subject: 'Your City Gate Capital Verification Code: {otp_code}',
    body: `<p>Dear {user_name},</p>
<p>Your one-time verification code is:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#C9A84C;text-align:center;">{otp_code}</p>
<p>This code expires in {expiry_time}. Do not share this code with anyone.</p>
<p>If you did not request this code, please secure your account immediately.</p>
<p>Best regards,<br/>City Gate Capital Security Team</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'security_alert',
    name: 'Security Alert',
    description: 'Sent on new login from unrecognised device or suspicious activity.',
    category: 'security',
    variables: ['{user_name}', '{alert_type}', '{ip_address}', '{location}', '{device}', '{date}'],
    subject: 'Security Alert: {alert_type} — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>We detected the following security event on your account:</p>
<p><strong>Alert Type:</strong> {alert_type}<br/>
<strong>IP Address:</strong> {ip_address}<br/>
<strong>Location:</strong> {location}<br/>
<strong>Device:</strong> {device}<br/>
<strong>Date:</strong> {date}</p>
<p>If this was you, no action is needed. If you do not recognise this activity, please change your password immediately and contact our support team.</p>
<p>Best regards,<br/>City Gate Capital Security Team</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
];

let cache: EmailTemplate[] | null = null;

// ── Store functions ───────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadTemplates(): EmailTemplate[] {
  if (cache) return cache.map(template => ({ ...template }));
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) return DEFAULTS.map(template => ({ ...template }));
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const saved = JSON.parse(raw) as EmailTemplate[];
    // Merge saved with defaults — add any new default templates not yet saved
    const savedIds = new Set(saved.map(t => t.id));
    const merged = [...saved];
    for (const def of DEFAULTS) {
      if (!savedIds.has(def.id)) merged.push(def);
    }
    cache = merged;
    return merged.map(template => ({ ...template }));
  } catch {
    return DEFAULTS.map(template => ({ ...template }));
  }
}

export function getTemplate(id: TemplateId): EmailTemplate | undefined {
  return loadTemplates().find(t => t.id === id);
}

/** Return an immutable copy of the reviewed built-in template. */
export function getDefaultTemplate(id: TemplateId): EmailTemplate | undefined {
  const template = DEFAULTS.find(t => t.id === id);
  return template ? { ...template } : undefined;
}

export function saveTemplate(id: TemplateId, patch: { subject?: string; body?: string }, updatedBy = 'admin'): EmailTemplate {
  ensureDir();
  const all = loadTemplates();
  const idx = all.findIndex(t => t.id === id);
  if (idx < 0) throw new Error(`Template not found: ${id}`);
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString(), updatedBy };
  cache = all;
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8'); } catch { /* DB remains authoritative in production */ }
  persistTemplates(all, updatedBy).catch(error =>
    console.error(JSON.stringify({ event: 'emailTemplates.write.failed', error: String(error) }))
  );
  return all[idx];
}

export function resetTemplate(id: TemplateId): EmailTemplate {
  const def = DEFAULTS.find(t => t.id === id);
  if (!def) throw new Error(`No default for template: ${id}`);
  return saveTemplate(id, { subject: def.subject, body: def.body }, 'system:reset');
}

/**
 * Substitute {variable} placeholders in a template subject/body.
 */
export function renderTemplate(template: EmailTemplate, vars: Record<string, string>): { subject: string; body: string } {
  let subject = template.subject;
  let body    = template.body;
  for (const [key, val] of Object.entries(vars)) {
    const placeholder = `{${key}}`;
    subject = subject.replaceAll(placeholder, val);
    body    = body.replaceAll(placeholder, val);
  }
  return { subject, body };
}

async function persistTemplates(templates: EmailTemplate[], updatedBy: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await getDb().insert(configTable)
    .values({ key: CONFIG_KEY, value: templates as unknown as Record<string, unknown>, updatedBy })
    .onConflictDoUpdate({
      target: configTable.key,
      set: { value: templates as unknown as Record<string, unknown>, updatedAt: new Date(), updatedBy },
    });
}

/** Load persisted admin template edits into the synchronous runtime cache. */
export async function loadEmailTemplatesFromDb(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const rows = await getDb().select().from(configTable).where(eq(configTable.key, CONFIG_KEY)).limit(1);
    if (!rows.length || !Array.isArray(rows[0].value)) return;
    const saved = rows[0].value as unknown as EmailTemplate[];
    const savedIds = new Set(saved.map(template => template.id));
    cache = [...saved, ...DEFAULTS.filter(template => !savedIds.has(template.id))];
  } catch (error) {
    console.warn(JSON.stringify({ event: 'emailTemplates.load.skipped', error: String(error) }));
  }
}
