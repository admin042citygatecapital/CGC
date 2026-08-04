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

const DATA_DIR  = '/private/email';
const DATA_FILE = path.join(DATA_DIR, 'templates.json');

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
    description: 'Sent immediately after a new account is registered.',
    category: 'account',
    variables: ['{user_name}', '{email}', '{date}', '{account_number}'],
    subject: 'Welcome to City Gate Capital, {user_name}!',
    body: `<p>Dear {user_name},</p>
<p>Welcome to <strong>City Gate Capital</strong>. Your account has been created successfully.</p>
<p><strong>Account Details:</strong><br/>
Email: {email}<br/>
Account Number: {account_number}<br/>
Date Joined: {date}</p>
<p>To get started, please complete your KYC identity verification to unlock full banking access.</p>
<p>If you have any questions, our support team is available 24/7.</p>
<p>Best regards,<br/>The City Gate Capital Team</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'kyc_approved',
    name: 'KYC Approved',
    description: 'Sent when admin approves a KYC submission.',
    category: 'kyc',
    variables: ['{user_name}', '{date}', '{account_number}'],
    subject: 'Your Identity Has Been Verified — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>We are pleased to inform you that your identity verification (KYC) has been <strong>approved</strong>.</p>
<p>You now have full access to all City Gate Capital services including:</p>
<ul>
  <li>International wire transfers</li>
  <li>Cryptocurrency transactions</li>
  <li>Virtual card issuance</li>
  <li>Higher withdrawal limits</li>
</ul>
<p>Verification Date: {date}</p>
<p>Best regards,<br/>City Gate Capital Compliance Team</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'kyc_rejected',
    name: 'KYC Rejected',
    description: 'Sent when admin rejects a KYC submission. Includes dynamic rejection reason.',
    category: 'kyc',
    variables: ['{user_name}', '{rejection_reason}', '{date}'],
    subject: 'Action Required: KYC Verification Unsuccessful — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>Unfortunately, your identity verification (KYC) submission could not be approved at this time.</p>
<p><strong>Reason:</strong> {rejection_reason}</p>
<p>Please log in to your account and resubmit your KYC with the correct documents. Ensure that:</p>
<ul>
  <li>All documents are clear and fully visible</li>
  <li>Documents are not expired</li>
  <li>Your selfie clearly shows your face alongside your ID</li>
</ul>
<p>If you believe this is an error, please contact our support team.</p>
<p>Best regards,<br/>City Gate Capital Compliance Team</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'deposit_confirmed',
    name: 'Deposit Confirmed',
    description: 'Sent when a deposit is confirmed on the account.',
    category: 'transaction',
    variables: ['{user_name}', '{amount}', '{currency}', '{date}', '{transaction_id}', '{account_number}'],
    subject: 'Deposit Confirmed: {amount} {currency} — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>Your deposit has been confirmed and credited to your account.</p>
<p><strong>Transaction Details:</strong><br/>
Amount: {amount} {currency}<br/>
Transaction ID: {transaction_id}<br/>
Account: {account_number}<br/>
Date: {date}</p>
<p>Your updated balance is now available in your dashboard.</p>
<p>Best regards,<br/>City Gate Capital</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'withdrawal_approved',
    name: 'Withdrawal Approved',
    description: 'Sent when a withdrawal request is approved.',
    category: 'transaction',
    variables: ['{user_name}', '{amount}', '{currency}', '{date}', '{transaction_id}'],
    subject: 'Withdrawal Approved: {amount} {currency} — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>Your withdrawal request has been approved and is being processed.</p>
<p><strong>Withdrawal Details:</strong><br/>
Amount: {amount} {currency}<br/>
Transaction ID: {transaction_id}<br/>
Date: {date}</p>
<p>Funds typically arrive within 1–3 business days depending on your bank.</p>
<p>Best regards,<br/>City Gate Capital</p>`,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
  {
    id: 'transfer_sent',
    name: 'Transfer Sent',
    description: 'Sent to the sender when an outgoing transfer is processed.',
    category: 'transaction',
    variables: ['{user_name}', '{amount}', '{currency}', '{recipient_name}', '{date}', '{transaction_id}'],
    subject: 'Transfer Sent: {amount} {currency} to {recipient_name}',
    body: `<p>Dear {user_name},</p>
<p>Your transfer has been sent successfully.</p>
<p><strong>Transfer Details:</strong><br/>
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
    name: 'Transfer Received',
    description: 'Sent to the recipient when an incoming transfer arrives.',
    category: 'transaction',
    variables: ['{user_name}', '{amount}', '{currency}', '{sender_name}', '{date}', '{transaction_id}'],
    subject: 'You Received {amount} {currency} — City Gate Capital',
    body: `<p>Dear {user_name},</p>
<p>You have received a transfer to your City Gate Capital account.</p>
<p><strong>Transfer Details:</strong><br/>
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

// ── Store functions ───────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadTemplates(): EmailTemplate[] {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) return [...DEFAULTS];
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const saved = JSON.parse(raw) as EmailTemplate[];
    // Merge saved with defaults — add any new default templates not yet saved
    const savedIds = new Set(saved.map(t => t.id));
    const merged = [...saved];
    for (const def of DEFAULTS) {
      if (!savedIds.has(def.id)) merged.push(def);
    }
    return merged;
  } catch {
    return [...DEFAULTS];
  }
}

export function getTemplate(id: TemplateId): EmailTemplate | undefined {
  return loadTemplates().find(t => t.id === id);
}

export function saveTemplate(id: TemplateId, patch: { subject?: string; body?: string }, updatedBy = 'admin'): EmailTemplate {
  ensureDir();
  const all = loadTemplates();
  const idx = all.findIndex(t => t.id === id);
  if (idx < 0) throw new Error(`Template not found: ${id}`);
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString(), updatedBy };
  fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8');
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
