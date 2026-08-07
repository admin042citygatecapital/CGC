/**
 * securityCenterStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent store for Security Center data not covered by existing stores:
 *  - RBAC Roles & Permissions
 *  - Rate Limit configuration (per-endpoint overrides)
 *  - Security Alerts (admin-facing, distinct from threat flags)
 *
 * Trusted Devices  → trustedDeviceStore.ts  (already exists)
 * IP Lists         → securityStore.ts        (already exists)
 * 2FA Policy       → securityStore.ts        (already exists)
 * Login History    → loginLog.ts             (already exists)
 * Audit Log        → securityStore.ts        (already exists)
 * User Sessions    → securityStore.ts        (already exists)
 */

import fs   from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DIR = '/private/security';
function ensureDir(file: string) {
  const d = path.dirname(file);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ─── RBAC Roles ───────────────────────────────────────────────────────────────

const ROLES_FILE = `${DIR}/roles.json`;

export type PermissionKey =
  | 'dashboard.view'
  | 'users.view' | 'users.create' | 'users.edit' | 'users.delete' | 'users.kyc'
  | 'cards.view' | 'cards.manage'
  | 'transactions.view' | 'transactions.approve' | 'transactions.reverse'
  | 'compliance.view' | 'compliance.manage'
  | 'reports.view' | 'reports.export'
  | 'email.view' | 'email.send'
  | 'cms.view' | 'cms.edit'
  | 'support.view' | 'support.respond' | 'support.close'
  | 'security.view' | 'security.manage'
  | 'config.view' | 'config.edit'
  | 'audit.view'
  | 'admin.create' | 'admin.delete';

export interface Role {
  id:          string;
  name:        string;
  label:       string;
  description: string;
  permissions: PermissionKey[];
  isSystem:    boolean;   // system roles cannot be deleted
  color:       string;    // hex
  createdAt:   string;
  updatedAt:   string;
}

const SYSTEM_ROLES: Role[] = [
  {
    id: 'role_super_admin', name: 'SUPER_ADMIN', label: 'Super Admin',
    description: 'Full unrestricted access to all platform features and configuration.',
    permissions: ['dashboard.view','users.view','users.create','users.edit','users.delete','users.kyc',
      'cards.view','cards.manage','transactions.view','transactions.approve','transactions.reverse',
      'compliance.view','compliance.manage','reports.view','reports.export','email.view','email.send',
      'cms.view','cms.edit','support.view','support.respond','support.close',
      'security.view','security.manage','config.view','config.edit','audit.view','admin.create','admin.delete'],
    isSystem: true, color: '#EF4444', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role_finance_admin', name: 'FINANCE_ADMIN', label: 'Finance Admin',
    description: 'Access to transactions, reports, and financial operations. Cannot modify users or security settings.',
    permissions: ['dashboard.view','transactions.view','transactions.approve','transactions.reverse',
      'reports.view','reports.export','users.view','cards.view'],
    isSystem: true, color: '#F59E0B', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role_security_admin', name: 'SECURITY_ADMIN', label: 'Security Admin',
    description: 'Access to security monitoring, IP lists, session management, and audit logs.',
    permissions: ['dashboard.view','security.view','security.manage','audit.view','users.view',
      'compliance.view','reports.view'],
    isSystem: true, color: '#8B5CF6', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role_support_admin', name: 'SUPPORT_ADMIN', label: 'Support Admin',
    description: 'Access to customer support, user profiles, and communication tools.',
    permissions: ['dashboard.view','users.view','users.edit','support.view','support.respond','support.close',
      'email.view','email.send','cards.view'],
    isSystem: true, color: '#3B82F6', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role_compliance_admin', name: 'COMPLIANCE_ADMIN', label: 'Compliance Admin',
    description: 'Access to KYC queue, AML flags, compliance reports, and audit logs.',
    permissions: ['dashboard.view','users.view','users.kyc','compliance.view','compliance.manage',
      'reports.view','reports.export','audit.view','transactions.view'],
    isSystem: true, color: '#10B981', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  },
];

export function readRoles(): Role[] {
  try {
    if (!fs.existsSync(ROLES_FILE)) return SYSTEM_ROLES;
    const saved = JSON.parse(fs.readFileSync(ROLES_FILE, 'utf8')) as Role[];
    // Merge: system roles always win on isSystem=true; custom roles are appended
    const savedMap = new Map(saved.map(r => [r.id, r]));
    const merged: Role[] = SYSTEM_ROLES.map(sr => {
      const s = savedMap.get(sr.id);
      // For system roles, only allow permission edits (not name/label/isSystem)
      return s ? { ...sr, permissions: s.permissions, updatedAt: s.updatedAt } : sr;
    });
    // Append custom (non-system) roles
    for (const r of saved) {
      if (!r.isSystem && !merged.find(m => m.id === r.id)) merged.push(r);
    }
    return merged;
  } catch { return SYSTEM_ROLES; }
}

export function writeRoles(roles: Role[]): void {
  ensureDir(ROLES_FILE);
  fs.writeFileSync(ROLES_FILE, JSON.stringify(roles, null, 2));
}

export function updateRolePermissions(roleId: string, permissions: PermissionKey[]): Role | null {
  const roles = readRoles();
  const idx = roles.findIndex(r => r.id === roleId);
  if (idx === -1) return null;
  roles[idx] = { ...roles[idx], permissions, updatedAt: new Date().toISOString() };
  writeRoles(roles);
  return roles[idx];
}

export function createCustomRole(data: { name: string; label: string; description: string; permissions: PermissionKey[]; color: string }): Role {
  const roles = readRoles();
  const role: Role = {
    ...data,
    id:        'role_' + crypto.randomBytes(6).toString('hex'),
    isSystem:  false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  roles.push(role);
  writeRoles(roles);
  return role;
}

export function deleteCustomRole(roleId: string): boolean {
  const roles = readRoles();
  const role = roles.find(r => r.id === roleId);
  if (!role || role.isSystem) return false;
  writeRoles(roles.filter(r => r.id !== roleId));
  return true;
}

// ─── Permission catalogue ─────────────────────────────────────────────────────

export interface PermissionDef {
  key:         PermissionKey;
  label:       string;
  description: string;
  group:       string;
  risk:        'low' | 'medium' | 'high' | 'critical';
}

export const PERMISSION_CATALOGUE: PermissionDef[] = [
  // Dashboard
  { key: 'dashboard.view',          label: 'View Dashboard',           description: 'Access the executive dashboard and KPI panels.',                         group: 'Dashboard',     risk: 'low' },
  // Users
  { key: 'users.view',              label: 'View Customers',           description: 'Read customer profiles, balances, and KYC status.',                      group: 'Customers',     risk: 'low' },
  { key: 'users.create',            label: 'Create Customers',         description: 'Create new customer accounts.',                                          group: 'Customers',     risk: 'medium' },
  { key: 'users.edit',              label: 'Edit Customers',           description: 'Modify customer profile data, status, and tier.',                        group: 'Customers',     risk: 'medium' },
  { key: 'users.delete',            label: 'Delete Customers',         description: 'Permanently delete customer accounts and associated data.',              group: 'Customers',     risk: 'critical' },
  { key: 'users.kyc',               label: 'Manage KYC',               description: 'Approve, reject, or request re-submission of KYC documents.',           group: 'Customers',     risk: 'high' },
  // Cards
  { key: 'cards.view',              label: 'View Cards',               description: 'View virtual card details and transaction history.',                     group: 'Cards',         risk: 'low' },
  { key: 'cards.manage',            label: 'Manage Cards',             description: 'Issue, freeze, replace, and set limits on virtual cards.',               group: 'Cards',         risk: 'high' },
  // Transactions
  { key: 'transactions.view',       label: 'View Transactions',        description: 'Read transaction records and history.',                                  group: 'Transactions',  risk: 'low' },
  { key: 'transactions.approve',    label: 'Approve Transactions',     description: 'Approve pending or flagged transactions.',                               group: 'Transactions',  risk: 'high' },
  { key: 'transactions.reverse',    label: 'Reverse Transactions',     description: 'Reverse or refund completed transactions.',                              group: 'Transactions',  risk: 'critical' },
  // Compliance
  { key: 'compliance.view',         label: 'View Compliance',          description: 'Access AML flags, KYC queue, and regulatory checklists.',               group: 'Compliance',    risk: 'low' },
  { key: 'compliance.manage',       label: 'Manage Compliance',        description: 'Resolve AML flags, update compliance status, and file reports.',        group: 'Compliance',    risk: 'high' },
  // Reports
  { key: 'reports.view',            label: 'View Reports',             description: 'Access P&L, revenue, and operational reports.',                         group: 'Reports',       risk: 'low' },
  { key: 'reports.export',          label: 'Export Reports',           description: 'Download reports as PDF or CSV.',                                       group: 'Reports',       risk: 'medium' },
  // Email
  { key: 'email.view',              label: 'View Email Center',        description: 'View email templates, queue, and delivery logs.',                       group: 'Email',         risk: 'low' },
  { key: 'email.send',              label: 'Send Emails',              description: 'Send transactional and bulk emails to customers.',                      group: 'Email',         risk: 'medium' },
  // CMS
  { key: 'cms.view',                label: 'View CMS',                 description: 'Read website content, banners, and SEO settings.',                     group: 'CMS',           risk: 'low' },
  { key: 'cms.edit',                label: 'Edit CMS',                 description: 'Modify website content, banners, navigation, and SEO settings.',       group: 'CMS',           risk: 'medium' },
  // Support
  { key: 'support.view',            label: 'View Support',             description: 'Read support tickets, messages, and feedback.',                         group: 'Support',       risk: 'low' },
  { key: 'support.respond',         label: 'Respond to Support',       description: 'Reply to tickets and customer messages.',                               group: 'Support',       risk: 'medium' },
  { key: 'support.close',           label: 'Close Support Tickets',    description: 'Close, archive, or escalate support tickets.',                         group: 'Support',       risk: 'medium' },
  // Security
  { key: 'security.view',           label: 'View Security',            description: 'Access security logs, alerts, and session data.',                      group: 'Security',      risk: 'low' },
  { key: 'security.manage',         label: 'Manage Security',          description: 'Modify IP lists, rate limits, 2FA policy, and terminate sessions.',    group: 'Security',      risk: 'critical' },
  // Config
  { key: 'config.view',             label: 'View Configuration',       description: 'Read platform configuration and feature flags.',                       group: 'Configuration', risk: 'low' },
  { key: 'config.edit',             label: 'Edit Configuration',       description: 'Modify platform configuration, feature flags, and exchange rates.',    group: 'Configuration', risk: 'high' },
  // Audit
  { key: 'audit.view',              label: 'View Audit Log',           description: 'Access the full admin audit trail.',                                   group: 'Audit',         risk: 'medium' },
  // Admin management
  { key: 'admin.create',            label: 'Create Admins',            description: 'Create new admin accounts and assign roles.',                          group: 'Admin Mgmt',    risk: 'critical' },
  { key: 'admin.delete',            label: 'Delete Admins',            description: 'Remove admin accounts.',                                               group: 'Admin Mgmt',    risk: 'critical' },
];

// ─── Rate Limit Config ────────────────────────────────────────────────────────

const RATE_LIMITS_FILE = `${DIR}/rate-limits.json`;

export interface RateLimitRule {
  id:          string;
  label:       string;
  description: string;
  path:        string;   // e.g. '/api/admin/auth/login' or '/api/*'
  windowMs:    number;
  max:         number;
  enabled:     boolean;
  isSystem:    boolean;
  updatedAt:   string;
}

const DEFAULT_RATE_LIMITS: RateLimitRule[] = [
  { id: 'rl_admin_login',    label: 'Admin Login',          description: 'Brute-force protection for admin login endpoint.',                path: '/api/admin/auth/login',  windowMs: 900_000,  max: 10,   enabled: true,  isSystem: true,  updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'rl_customer_login', label: 'Customer Login',       description: 'Rate limit on customer authentication endpoint.',                 path: '/api/auth/login',        windowMs: 900_000,  max: 20,   enabled: true,  isSystem: true,  updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'rl_otp',            label: 'OTP / 2FA Requests',   description: 'Limit OTP send requests to prevent SMS/email flooding.',          path: '/api/auth/otp',          windowMs: 3_600_000, max: 5,  enabled: true,  isSystem: true,  updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'rl_kyc_upload',     label: 'KYC Document Upload',  description: 'Limit document upload attempts per customer.',                    path: '/api/kyc/upload',        windowMs: 3_600_000, max: 10, enabled: true,  isSystem: false, updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'rl_api_global',     label: 'Global API',           description: 'Catch-all rate limit for all API endpoints.',                     path: '/api/*',                 windowMs: 60_000,   max: 200,  enabled: true,  isSystem: false, updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'rl_email_send',     label: 'Email Send',           description: 'Limit transactional email sends to prevent abuse.',               path: '/api/admin/email/send',  windowMs: 3_600_000, max: 50, enabled: true,  isSystem: false, updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'rl_password_reset', label: 'Password Reset',       description: 'Limit password reset requests to prevent enumeration attacks.',   path: '/api/auth/reset',        windowMs: 3_600_000, max: 5,  enabled: true,  isSystem: true,  updatedAt: '2024-01-01T00:00:00Z' },
];

export function readRateLimits(): RateLimitRule[] {
  try {
    if (!fs.existsSync(RATE_LIMITS_FILE)) return DEFAULT_RATE_LIMITS;
    const saved = JSON.parse(fs.readFileSync(RATE_LIMITS_FILE, 'utf8')) as RateLimitRule[];
    const savedMap = new Map(saved.map(r => [r.id, r]));
    const merged = DEFAULT_RATE_LIMITS.map(def => savedMap.get(def.id) ?? def);
    for (const r of saved) {
      if (!merged.find(m => m.id === r.id)) merged.push(r);
    }
    return merged;
  } catch { return DEFAULT_RATE_LIMITS; }
}

export function writeRateLimits(rules: RateLimitRule[]): void {
  ensureDir(RATE_LIMITS_FILE);
  fs.writeFileSync(RATE_LIMITS_FILE, JSON.stringify(rules, null, 2));
}

export function updateRateLimitRule(id: string, patch: Partial<Pick<RateLimitRule, 'windowMs' | 'max' | 'enabled'>>): RateLimitRule | null {
  const rules = readRateLimits();
  const idx = rules.findIndex(r => r.id === id);
  if (idx === -1) return null;
  rules[idx] = { ...rules[idx], ...patch, updatedAt: new Date().toISOString() };
  writeRateLimits(rules);
  return rules[idx];
}

// ─── Security Alerts ──────────────────────────────────────────────────────────

const ALERTS_FILE = `${DIR}/security-alerts.jsonl`;

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertType =
  | 'brute_force' | 'ip_blocked' | 'session_hijack' | 'unusual_admin_activity'
  | 'mass_login_failure' | 'rate_limit_exceeded' | 'new_admin_login'
  | 'config_change' | 'permission_change' | 'manual';

export interface SecurityAlert {
  id:         string;
  ts:         string;
  type:       AlertType;
  severity:   AlertSeverity;
  title:      string;
  detail:     string;
  ip?:        string;
  userId?:    string;
  adminId?:   string;
  count?:     number;
  resolved:   boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  meta?:      Record<string, unknown>;
}

export function loadAlerts(limit = 200): SecurityAlert[] {
  try {
    if (!fs.existsSync(ALERTS_FILE)) return [];
    return fs.readFileSync(ALERTS_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => JSON.parse(l) as SecurityAlert)
      .reverse()
      .slice(0, limit);
  } catch { return []; }
}

export function appendAlert(data: Omit<SecurityAlert, 'id' | 'ts'>): SecurityAlert {
  ensureDir(ALERTS_FILE);
  const alert: SecurityAlert = {
    ...data,
    id: 'alrt_' + crypto.randomBytes(6).toString('hex'),
    ts: new Date().toISOString(),
  };
  fs.appendFileSync(ALERTS_FILE, JSON.stringify(alert) + '\n');
  return alert;
}

export function resolveAlert(id: string, resolvedBy: string): boolean {
  try {
    if (!fs.existsSync(ALERTS_FILE)) return false;
    const alerts = fs.readFileSync(ALERTS_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => JSON.parse(l) as SecurityAlert);
    const idx = alerts.findIndex(a => a.id === id);
    if (idx === -1) return false;
    alerts[idx].resolved   = true;
    alerts[idx].resolvedAt = new Date().toISOString();
    alerts[idx].resolvedBy = resolvedBy;
    fs.writeFileSync(ALERTS_FILE, alerts.map(a => JSON.stringify(a)).join('\n') + '\n');
    return true;
  } catch { return false; }
}

export function alertStats(): { total: number; unresolved: number; bySeverity: Record<string, number> } {
  const alerts = loadAlerts(1000);
  const unresolved = alerts.filter(a => !a.resolved);
  const bySeverity: Record<string, number> = {};
  for (const a of unresolved) bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
  return { total: alerts.length, unresolved: unresolved.length, bySeverity };
}
