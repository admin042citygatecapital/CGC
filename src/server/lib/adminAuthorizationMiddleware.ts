/** Permission-based, fail-closed authorization for the administration API. */
import type { NextFunction, Request, Response } from 'express';
import type { AdminRole } from './sessionStore.js';
import { readRoles, type PermissionKey } from './securityCenterStore.js';

export const PUBLIC_ADMIN_PATHS = new Set([
  '/auth/login', '/auth/password-reset', '/auth/password-reset/confirm',
  '/auth/otp/verify', '/auth/otp/resend', '/auth/diag', '/auth/verify',
  '/zoho/oauth/callback', '/sponsor-readiness/external-review',
]);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
interface PermissionRule { prefixes: readonly string[]; read: PermissionKey; write?: PermissionKey }
const PERMISSION_RULES: readonly PermissionRule[] = [
  { prefixes: ['/auth/logout'], read: 'dashboard.view' },
  { prefixes: ['/auth/unlock'], read: 'security.view', write: 'security.manage' },
  { prefixes: ['/auth/trusted-devices'], read: 'security.view', write: 'security.manage' },
  { prefixes: ['/security/roles'], read: 'security.view', write: 'admin.roles.manage' },
  { prefixes: ['/administrators'], read: 'security.view', write: 'admin.roles.manage' },
  { prefixes: ['/security'], read: 'security.view', write: 'security.manage' },
  { prefixes: ['/balance'], read: 'accounts.view', write: 'ledger.adjust' },
  { prefixes: ['/customer-accounts'], read: 'accounts.view', write: 'accounts.manage' },
  { prefixes: ['/transactions', '/financial-sandbox'], read: 'transactions.view', write: 'transactions.approve' },
  { prefixes: ['/reconciliation'], read: 'reconciliation.view', write: 'reconciliation.manage' },
  { prefixes: ['/cards'], read: 'cards.view', write: 'cards.manage' },
  { prefixes: ['/wallets'], read: 'wallets.view', write: 'wallets.manage' },
  { prefixes: ['/trading'], read: 'trading.view', write: 'trading.manage' },
  { prefixes: ['/kyc/aml'], read: 'compliance.view', write: 'compliance.manage' },
  { prefixes: ['/kyc'], read: 'compliance.view', write: 'users.kyc' },
  { prefixes: ['/applications', '/kyc-cases'], read: 'compliance.view', write: 'compliance.manage' },
  { prefixes: ['/onboarding/compliance-cases', '/onboarding/monitoring', '/onboarding/screening'], read: 'compliance.view', write: 'compliance.manage' },
  { prefixes: ['/onboarding'], read: 'compliance.view', write: 'users.kyc' },
  { prefixes: ['/legal-entity', '/assurance-exercises', '/sponsor-readiness', '/readiness'], read: 'compliance.view', write: 'compliance.manage' },
  { prefixes: ['/users'], read: 'users.view', write: 'users.edit' },
  { prefixes: ['/customer-relationships', '/contacts'], read: 'users.view', write: 'users.edit' },
  { prefixes: ['/disputes'], read: 'transactions.view', write: 'transactions.approve' },
  { prefixes: ['/support', '/tickets'], read: 'support.view', write: 'support.respond' },
  { prefixes: ['/email', '/newsletter'], read: 'email.view', write: 'email.send' },
  { prefixes: ['/cms', '/website'], read: 'cms.view', write: 'cms.edit' },
  { prefixes: ['/media'], read: 'media.view', write: 'media.manage' },
  { prefixes: ['/rates'], read: 'rates.view', write: 'rates.manage' },
  { prefixes: ['/integrations', '/zoho', '/smtp', '/tawk', '/chatbot', '/social'], read: 'integrations.view', write: 'integrations.manage' },
  { prefixes: ['/features'], read: 'features.view', write: 'features.manage' },
  { prefixes: ['/config', '/settings'], read: 'config.view', write: 'config.edit' },
  { prefixes: ['/health', '/env-report', '/database', '/deployments'], read: 'health.view' },
  { prefixes: ['/operations', '/notifications', '/provider-sandbox'], read: 'operations.view', write: 'operations.manage' },
  { prefixes: ['/reports'], read: 'reports.view', write: 'reports.export' },
  // Analytics reports are mounted on /api/analytics, outside the /api/admin
  // prefix where requireAdminAuthorization is globally attached. These suffix
  // rules apply when that middleware is mounted directly on /api/analytics;
  // the consent-gated POST /event collector is skipped before authorization.
  // Gating analytics reads on reports.view deliberately tightens what was
  // previously readable by every authenticated administrator: SUPPORT_ADMIN
  // and CONTENT_ADMIN hold no reports.view, so they now receive 403 here.
  // Grant reports.view to a role (Security → Roles) to restore its access.
  { prefixes: ['/ab-results', '/conversions', '/summary'], read: 'reports.view' },
  { prefixes: ['/audit'], read: 'audit.view' },
  { prefixes: ['/stats', '/search', '/links'], read: 'dashboard.view' },
  { prefixes: ['/developer', '/documentation'], read: 'config.view' },
];

function normalizePath(path: string): string {
  if (!path || path === '/') return '/';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}
function matchesPrefix(path: string, prefix: string): boolean { return path === prefix || path.startsWith(`${prefix}/`); }

export function requiredPermissionForAdminRequest(path: string, method: string): PermissionKey | null | undefined {
  const normalizedPath = normalizePath(path);
  if (PUBLIC_ADMIN_PATHS.has(normalizedPath)) return null;
  const rule = PERMISSION_RULES.find(candidate => candidate.prefixes.some(prefix => matchesPrefix(normalizedPath, prefix)));
  if (!rule) return undefined;
  return SAFE_METHODS.has(method.toUpperCase()) ? rule.read : (rule.write ?? rule.read);
}

/** Retained for route-inventory compatibility. Authorization uses permissions below. */
export function allowedRolesForAdminRequest(path: string, method: string): readonly AdminRole[] | null {
  const permission = requiredPermissionForAdminRequest(path, method);
  return permission === null ? null : [];
}

export async function permissionsForAdminRole(role: AdminRole): Promise<PermissionKey[]> {
  const configured = (await readRoles()).find(candidate => candidate.name === role && candidate.isSystem);
  return configured?.permissions ?? [];
}

export async function requireAdminAuthorization(req: Request, res: Response, next: NextFunction): Promise<void> {
  const permission = requiredPermissionForAdminRequest(req.path, req.method);
  if (permission === null) { next(); return; }
  const session = req.adminSession;
  if (!session) { res.status(401).json({ error: 'Authentication required' }); return; }
  if (permission === undefined) {
    res.status(403).json({ error: 'No administration permission is mapped for this route.', code: 'ADMIN_ROUTE_UNMAPPED' });
    return;
  }
  if (session.role === 'SUPER_ADMIN') { next(); return; }
  try {
    if ((await permissionsForAdminRole(session.role)).includes(permission)) { next(); return; }
  } catch {
    res.status(503).json({ error: 'Administration authorization policy is unavailable.', code: 'RBAC_UNAVAILABLE' });
    return;
  }
  res.status(403).json({ error: 'Your administration role does not permit this action.', code: 'ADMIN_PERMISSION_REQUIRED', permission });
}
