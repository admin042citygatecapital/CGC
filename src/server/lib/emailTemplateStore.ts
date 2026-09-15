/**
 * emailTemplateStore.ts
 * Persistent store for admin-editable system email templates.
 * Stored in /private/email/templates.json
 *
 * Supports the complete transactional template catalogue + variable substitution.
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
  | 'email_verification'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'application_received'
  | 'application_started'
  | 'application_under_review'
  | 'application_needs_information'
  | 'application_approved'
  | 'application_activation_pending'
  | 'application_rejected'
  | 'deposit_confirmed'
  | 'withdrawal_approved'
  | 'transfer_sent'
  | 'transfer_received'
  | 'password_reset'
  | 'two_fa_code'
  | 'security_alert'
  | 'login_alert'
  | 'support_reply';

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
    id: 'email_verification',
    name: 'Email Verification',
    description: 'Sent when a customer must verify their registered email address.',
    category: 'auth',
    variables: ['{user_name}', '{verification_link}', '{expiry_time}'],
    subject: 'Verify Your Email — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>Please verify your email address to continue your City Gate Capital registration.</p>
<p><a href="{verification_link}" style="background:#C9A84C;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Verify Email Address</a></p>
<p>This link expires in {expiry_time}. If you did not register, you can ignore this email.</p>`,
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
    name: 'Identity Review Decision',
    description: 'Notification that an identity-review case was not approved.',
    category: 'kyc',
    variables: ['{user_name}', '{rejection_reason}', '{date}'],
    subject: 'Identity Review Decision — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>Your current identity-review case was not approved as of {date}.</p>
<p><strong>Reviewer note:</strong> {rejection_reason}</p>
<p>This decision does not by itself activate banking, payments, cards, trading, custody, or other financial services. If you have a question about this decision, contact support@citygate.capital. No response-time guarantee is offered.</p>
<p>Best regards,<br/>The City Gate Capital Team</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'application_received',
    name: 'Application Received',
    description: 'Sent when a customer submits an account application for review.',
    category: 'kyc',
    variables: ['{user_name}', '{reference}', '{account_type}', '{date}'],
    subject: 'Application Received: {reference} — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>Your {account_type} application ({reference}) was received on {date} and is queued for review. No further action is needed from you at this stage.</p>
<p>This acknowledgment does not open an account and does not activate banking, payments, cards, trading, custody, or any other financial service. Review, provider verification, and eligibility checks are still outstanding, and financial services are not currently activated on this platform.</p>
<p>Please do not send identity documents, payment details, or funds by email. Any requested information will be collected only through the secure application area after sign-in.</p>
<p>Best regards,<br/>The City Gate Capital Team</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'application_under_review',
    name: 'Application In Review',
    description: 'Sent when an application or identity-review case moves into the review stage.',
    category: 'kyc',
    variables: ['{user_name}', '{date}'],
    subject: 'Your Application Is In Review — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>Your application has moved into the review stage as of {date}. Reviews are completed by our compliance team and may involve identity, sanctions, and eligibility checks.</p>
<p>This notice does not activate banking, payments, cards, trading, custody, or other financial services. Final decisions on account approval and activation remain pending.</p>
<p>Best regards,<br/>The City Gate Capital Team</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'application_needs_information',
    name: 'Application Information Request',
    description: 'Sent when an application decision requests additional information.',
    category: 'kyc',
    variables: ['{user_name}', '{reference}', '{information_request}', '{date}'],
    subject: 'Information Required: {reference} — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>Your application ({reference}) needs additional information before the review can continue.</p>
<p><strong>Reviewer instructions:</strong> {information_request}</p>
<p>Provide the requested information only through the secure application area after sign-in. No financial service is activated by this request.</p>
<p>Best regards,<br/>The City Gate Capital Team</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'application_approved',
    name: 'Application Approved — Activation Pending',
    description: 'Sent when an account application is approved and final activation is still pending.',
    category: 'kyc',
    variables: ['{user_name}', '{reference}', '{date}'],
    subject: 'Application Approved: {reference} — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>Your application ({reference}) has been approved as of {date}. Final account activation remains pending.</p>
<p>This approval does not by itself activate banking, payments, cards, trading, custody, or any other financial service. Product access remains subject to provider verification, eligibility, and applicable approvals, and financial services are not currently activated on this platform.</p>
<p>Best regards,<br/>The City Gate Capital Team</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'application_activation_pending',
    name: 'Application Activation Pending',
    description: 'Sent when an application decision records the activation-pending stage.',
    category: 'kyc',
    variables: ['{user_name}', '{reference}', '{date}'],
    subject: 'Application Decision Recorded: {reference} — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>A decision was recorded on your application ({reference}) as of {date}. Your account is now awaiting final activation.</p>
<p>Final activation is not automatic: it requires provider verification, eligibility, and applicable approvals. No financial service is activated by this notice.</p>
<p>Best regards,<br/>The City Gate Capital Team</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'application_rejected',
    name: 'Application Decision — Not Approved',
    description: 'Sent when an account application is not approved.',
    category: 'kyc',
    variables: ['{user_name}', '{reference}', '{decision_reason}', '{date}'],
    subject: 'Application Decision: {reference} — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>After review, your application ({reference}) was not approved as of {date}.</p>
<p><strong>Reviewer note:</strong> {decision_reason}</p>
<p>This decision does not create an account and no financial service is activated. If you believe this decision was made in error, contact support@citygate.capital. No response-time guarantee is offered.</p>
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
    subject: 'Your Verification Code — City Gate Capital',
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
  {
    id: 'login_alert',
    name: 'Login Alert',
    description: 'Sent after a successful login or when a new device is detected.',
    category: 'security',
    variables: ['{user_name}', '{ip_address}', '{device}', '{date}', '{security_link}'],
    subject: 'New Login Recorded — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>A successful login to your City Gate Capital account was recorded.</p>
<p><strong>Time:</strong> {date}<br/><strong>IP Address:</strong> {ip_address}<br/><strong>Device:</strong> {device}</p>
<p>If this was not you, review and revoke active sessions immediately.</p>
<p><a href="{security_link}" style="color:#C9A84C;">Open Security Centre</a></p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'support_reply',
    name: 'Support Reply',
    description: 'Sent when the support team replies to a customer request.',
    category: 'account',
    variables: ['{user_name}', '{ticket_subject}', '{reply_message}', '{support_link}', '{date}'],
    subject: 'Support Update: {ticket_subject} — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>Our support team has replied to your request, <strong>{ticket_subject}</strong>.</p>
<div style="border-left:3px solid #C9A84C;padding:12px 16px;margin:18px 0;">{reply_message}</div>
<p><a href="{support_link}" style="color:#C9A84C;">View your support request</a></p>
<p>Reply date: {date}</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
];

let cache: EmailTemplate[] | null = null;

// The kyc_rejected default was corrected from a needs-information notice to a
// decision notice. Persisted stores save the whole catalogue whenever an admin
// edits ANY template, so environments that did so still hold the OLD default
// text; copies matching it verbatim have ONLY the body swapped for the
// corrected default — a persisted name or subject (an admin customization in
// its own right) is preserved as-is. Genuine admin customizations, which
// differ in body text, are left untouched.
const STALE_KYC_REJECTED_BODY = `<p>Dear {user_name},</p>
<p>Your identity-review workflow needs additional information.</p>
<p><strong>Reviewer note:</strong> {rejection_reason}</p>
<p>Submit information only through the secure onboarding workflow. This notice does not by itself activate a financial service.</p>
<p>Best regards,<br/>The City Gate Capital Team</p>`;

/** Replace only the stale default body, preserving each copy's own name and subject. */
function withCorrectedDefaults(saved: EmailTemplate[]): EmailTemplate[] {
  const correctedBody = DEFAULTS.find(def => def.id === 'kyc_rejected')!.body;
  return saved.map(template =>
    template.id === 'kyc_rejected' && template.body === STALE_KYC_REJECTED_BODY
      ? { ...template, body: correctedBody }
      : template);
}

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
    // Merge saved with defaults — correct superseded defaults, add any new default templates not yet saved
    const savedIds = new Set(saved.map(t => t.id));
    const merged = withCorrectedDefaults(saved);
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
    cache = [...withCorrectedDefaults(saved), ...DEFAULTS.filter(template => !savedIds.has(template.id))];
  } catch (error) {
    console.warn(JSON.stringify({ event: 'emailTemplates.load.skipped', error: String(error) }));
  }
}
