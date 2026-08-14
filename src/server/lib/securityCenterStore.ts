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
import { privateSubdirectory } from './storagePaths.js';
import { getQueryClient, isDatabaseConfigured } from '../db/db.js';
import { readConfigDocument, writeConfigDocument } from './durableConfigDocument.js';

const DIR = privateSubdirectory('security');

// ─── RBAC Roles ───────────────────────────────────────────────────────────────

const ROLES_FILE = path.join(DIR, 'roles.json');
const ROLES_CONFIG_KEY = 'security_center_roles';

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

function mergeRoles(saved: Role[]): Role[] {
  const savedMap = new Map(saved.map(role => [role.id, role]));
  const merged = SYSTEM_ROLES.map(systemRole => {
    const savedRole = savedMap.get(systemRole.id);
    return savedRole ? { ...systemRole, permissions: savedRole.permissions, updatedAt: savedRole.updatedAt } : systemRole;
  });
  for (const role of saved) {
    if (!role.isSystem && !merged.find(existing => existing.id === role.id)) merged.push(role);
  }
  return merged;
}

export async function readRoles(): Promise<Role[]> {
  return mergeRoles(await readConfigDocument(ROLES_CONFIG_KEY, ROLES_FILE, SYSTEM_ROLES));
}

export async function writeRoles(roles: Role[], updatedBy = 'admin'): Promise<void> {
  await writeConfigDocument(ROLES_CONFIG_KEY, ROLES_FILE, roles, updatedBy);
}

export async function updateRolePermissions(roleId: string, permissions: PermissionKey[], updatedBy = 'admin'): Promise<Role | null> {
  const roles = await readRoles();
  const idx = roles.findIndex(r => r.id === roleId);
  if (idx === -1) return null;
  roles[idx] = { ...roles[idx], permissions, updatedAt: new Date().toISOString() };
  await writeRoles(roles, updatedBy);
  return roles[idx];
}

export async function createCustomRole(data: { name: string; label: string; description: string; permissions: PermissionKey[]; color: string }, updatedBy = 'admin'): Promise<Role> {
  const roles = await readRoles();
  const role: Role = {
    ...data,
    id:        'role_' + crypto.randomBytes(6).toString('hex'),
    isSystem:  false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  roles.push(role);
  await writeRoles(roles, updatedBy);
  return role;
}

export async function deleteCustomRole(roleId: string, updatedBy = 'admin'): Promise<boolean> {
  const roles = await readRoles();
  const role = roles.find(r => r.id === roleId);
  if (!role || role.isSystem) return false;
  await writeRoles(roles.filter(r => r.id !== roleId), updatedBy);
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

const RATE_LIMITS_FILE = path.join(DIR, 'rate-limits.json');
const RATE_LIMITS_CONFIG_KEY = 'security_center_rate_limits';

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

function mergeRateLimits(saved: RateLimitRule[]): RateLimitRule[] {
  const savedMap = new Map(saved.map(rule => [rule.id, rule]));
  const merged = DEFAULT_RATE_LIMITS.map(defaultRule => savedMap.get(defaultRule.id) ?? defaultRule);
  for (const rule of saved) if (!merged.find(existing => existing.id === rule.id)) merged.push(rule);
  return merged;
}

export async function readRateLimits(): Promise<RateLimitRule[]> {
  return mergeRateLimits(await readConfigDocument(RATE_LIMITS_CONFIG_KEY, RATE_LIMITS_FILE, DEFAULT_RATE_LIMITS));
}

export async function writeRateLimits(rules: RateLimitRule[], updatedBy = 'admin'): Promise<void> {
  await writeConfigDocument(RATE_LIMITS_CONFIG_KEY, RATE_LIMITS_FILE, rules, updatedBy);
}

export async function updateRateLimitRule(id: string, patch: Partial<Pick<RateLimitRule, 'windowMs' | 'max' | 'enabled'>>, updatedBy = 'admin'): Promise<RateLimitRule | null> {
  const rules = await readRateLimits();
  const idx = rules.findIndex(r => r.id === id);
  if (idx === -1) return null;
  rules[idx] = { ...rules[idx], ...patch, updatedAt: new Date().toISOString() };
  await writeRateLimits(rules, updatedBy);
  return rules[idx];
}

// ─── Security Alerts ──────────────────────────────────────────────────────────

const ALERTS_FILE = path.join(DIR, 'security-alerts.jsonl');

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

function readLegacyAlerts(): SecurityAlert[] {
  try {
    if (!fs.existsSync(ALERTS_FILE)) return [];
    return fs.readFileSync(ALERTS_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .flatMap(line => {
        try { return [JSON.parse(line) as SecurityAlert]; } catch { return []; }
      });
  } catch { return []; }
}

function writeLegacyAlerts(alerts: SecurityAlert[]): void {
  fs.mkdirSync(path.dirname(ALERTS_FILE), { recursive: true });
  fs.writeFileSync(ALERTS_FILE, `${alerts.map(alert => JSON.stringify(alert)).join('\n')}\n`, 'utf8');
}

function requireAlertsDatabaseInProduction(): void {
  if (process.env.NODE_ENV === 'production' && !isDatabaseConfigured()) throw new Error('SECURITY_ALERT_DATABASE_UNAVAILABLE');
}

let alertMigrationPromise: Promise<void> | null = null;
async function ensureLegacyAlertsMigrated(): Promise<void> {
  requireAlertsDatabaseInProduction();
  if (!isDatabaseConfigured()) return;
  if (alertMigrationPromise) return alertMigrationPromise;
  alertMigrationPromise = (async () => {
    const sql = getQueryClient();
    for (const alert of readLegacyAlerts()) {
      await sql`
        INSERT INTO security_center_alerts
          (id, ts, type, severity, title, detail, ip, user_id, admin_id, event_count, resolved,
           resolved_at, resolved_by, meta)
        VALUES (${alert.id}, ${alert.ts}, ${alert.type}, ${alert.severity}, ${alert.title}, ${alert.detail},
          ${alert.ip ?? null}, ${alert.userId ?? null}, ${alert.adminId ?? null}, ${alert.count ?? null},
          ${alert.resolved}, ${alert.resolvedAt ?? null}, ${alert.resolvedBy ?? null},
          ${sql.json((alert.meta ?? {}) as never)})
        ON CONFLICT (id) DO NOTHING
      `;
    }
  })();
  return alertMigrationPromise;
}

function mapAlertRow(row: Record<string, unknown>): SecurityAlert {
  return {
    id: String(row.id),
    ts: new Date(row.ts as string | Date).toISOString(),
    type: row.type as AlertType,
    severity: row.severity as AlertSeverity,
    title: String(row.title),
    detail: String(row.detail),
    ip: row.ip ? String(row.ip) : undefined,
    userId: row.user_id ? String(row.user_id) : undefined,
    adminId: row.admin_id ? String(row.admin_id) : undefined,
    count: row.event_count === null || row.event_count === undefined ? undefined : Number(row.event_count),
    resolved: Boolean(row.resolved),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at as string | Date).toISOString() : undefined,
    resolvedBy: row.resolved_by ? String(row.resolved_by) : undefined,
    meta: row.meta && typeof row.meta === 'object' ? row.meta as Record<string, unknown> : {},
  };
}

export async function loadAlerts(limit = 200): Promise<SecurityAlert[]> {
  requireAlertsDatabaseInProduction();
  const safeLimit = Math.max(1, Math.min(limit, 2_000));
  if (!isDatabaseConfigured()) return readLegacyAlerts().reverse().slice(0, safeLimit);
  await ensureLegacyAlertsMigrated();
  const rows = await getQueryClient()<Array<Record<string, unknown>>>`
    SELECT * FROM security_center_alerts ORDER BY ts DESC, id DESC LIMIT ${safeLimit}
  `;
  return rows.map(mapAlertRow);
}

export async function appendAlert(data: Omit<SecurityAlert, 'id' | 'ts'>): Promise<SecurityAlert> {
  requireAlertsDatabaseInProduction();
  const alert: SecurityAlert = {
    ...data,
    id: 'alrt_' + crypto.randomBytes(6).toString('hex'),
    ts: new Date().toISOString(),
  };
  if (!isDatabaseConfigured()) {
    writeLegacyAlerts([...readLegacyAlerts(), alert]);
    return alert;
  }
  await ensureLegacyAlertsMigrated();
  const sql = getQueryClient();
  await sql`
    INSERT INTO security_center_alerts
      (id, ts, type, severity, title, detail, ip, user_id, admin_id, event_count, resolved,
       resolved_at, resolved_by, meta)
    VALUES (${alert.id}, ${alert.ts}, ${alert.type}, ${alert.severity}, ${alert.title}, ${alert.detail},
      ${alert.ip ?? null}, ${alert.userId ?? null}, ${alert.adminId ?? null}, ${alert.count ?? null},
      ${alert.resolved}, ${alert.resolvedAt ?? null}, ${alert.resolvedBy ?? null},
      ${sql.json((alert.meta ?? {}) as never)})
  `;
  return alert;
}

export async function resolveAlert(id: string, resolvedBy: string): Promise<boolean> {
  requireAlertsDatabaseInProduction();
  if (!isDatabaseConfigured()) {
    const alerts = readLegacyAlerts();
    const idx = alerts.findIndex(a => a.id === id);
    if (idx === -1) return false;
    alerts[idx].resolved   = true;
    alerts[idx].resolvedAt = new Date().toISOString();
    alerts[idx].resolvedBy = resolvedBy;
    writeLegacyAlerts(alerts);
    return true;
  }
  await ensureLegacyAlertsMigrated();
  const rows = await getQueryClient()<Array<{ id: string }>>`
    UPDATE security_center_alerts
    SET resolved=TRUE, resolved_at=NOW(), resolved_by=${resolvedBy}
    WHERE id=${id} AND resolved=FALSE RETURNING id
  `;
  return rows.length === 1;
}

export async function alertStats(): Promise<{ total: number; unresolved: number; bySeverity: Record<string, number> }> {
  const alerts = await loadAlerts(2_000);
  const unresolved = alerts.filter(a => !a.resolved);
  const bySeverity: Record<string, number> = {};
  for (const a of unresolved) bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
  return { total: alerts.length, unresolved: unresolved.length, bySeverity };
}
