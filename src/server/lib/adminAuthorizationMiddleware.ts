/**
 * Central authorization policy for the administration API.
 *
 * Authentication answers "who is this?"; this middleware answers "may this
 * role access this operational area?". SUPER_ADMIN remains the only role with
 * unrestricted access. Unknown/new admin routes therefore fail closed.
 */
import type { NextFunction, Request, Response } from 'express';
import type { AdminRole } from './sessionStore.js';

const PUBLIC_ADMIN_PATHS = new Set([
  '/auth/login',
  '/auth/password-reset',
  '/auth/password-reset/confirm',
  '/auth/otp/verify',
  '/auth/unlock',
  '/auth/diag',
  '/auth/verify',
  '/zoho/oauth/callback',
]);

type Rule = {
  prefix: string;
  roles: readonly AdminRole[];
  methods?: readonly string[];
};

const RULES: readonly Rule[] = [
  { prefix: '/stats', roles: ['FINANCE_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN', 'COMPLIANCE_ADMIN'] },
  { prefix: '/operations', roles: ['FINANCE_ADMIN', 'SUPPORT_ADMIN', 'COMPLIANCE_ADMIN'] },
  { prefix: '/health', roles: ['FINANCE_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN', 'COMPLIANCE_ADMIN'] },
  // Public brand publishing remains a super-administrator responsibility
  // until a dedicated communications role is introduced.
  { prefix: '/social', roles: [] },

  { prefix: '/security/roles', roles: [], methods: ['POST', 'PUT', 'PATCH', 'DELETE'] },
  { prefix: '/security', roles: ['SECURITY_ADMIN'] },
  { prefix: '/audit', roles: ['SECURITY_ADMIN', 'COMPLIANCE_ADMIN'] },
  { prefix: '/readiness', roles: ['SECURITY_ADMIN'] },
  { prefix: '/sponsor-readiness', roles: ['FINANCE_ADMIN', 'SECURITY_ADMIN', 'COMPLIANCE_ADMIN'] },
  { prefix: '/developer', roles: ['SECURITY_ADMIN'] },
  { prefix: '/documentation', roles: ['SECURITY_ADMIN'] },
  { prefix: '/env-report', roles: ['SECURITY_ADMIN'] },

  { prefix: '/kyc', roles: ['COMPLIANCE_ADMIN'] },
  { prefix: '/users/approve', roles: ['COMPLIANCE_ADMIN'] },
  { prefix: '/users/reject', roles: ['COMPLIANCE_ADMIN'] },
  { prefix: '/users/reset-2fa', roles: ['SECURITY_ADMIN'] },
  { prefix: '/users/:id/security-events', roles: ['SECURITY_ADMIN'] },
  { prefix: '/users/:id/devices', roles: ['SECURITY_ADMIN'] },
  { prefix: '/users/:id/login-history', roles: ['SECURITY_ADMIN'] },
  { prefix: '/users/:id/audit', roles: ['SECURITY_ADMIN', 'COMPLIANCE_ADMIN'] },
  { prefix: '/users', roles: ['FINANCE_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN', 'COMPLIANCE_ADMIN'], methods: ['GET'] },

  { prefix: '/balance', roles: ['FINANCE_ADMIN'] },
  { prefix: '/transactions', roles: ['FINANCE_ADMIN', 'COMPLIANCE_ADMIN'], methods: ['GET'] },
  { prefix: '/transactions/approve', roles: ['FINANCE_ADMIN', 'COMPLIANCE_ADMIN'] },
  { prefix: '/transactions/reject', roles: ['FINANCE_ADMIN', 'COMPLIANCE_ADMIN'] },
  { prefix: '/transactions/freeze', roles: ['FINANCE_ADMIN', 'COMPLIANCE_ADMIN'] },
  { prefix: '/transactions', roles: ['FINANCE_ADMIN'] },
  { prefix: '/cards', roles: ['FINANCE_ADMIN'] },
  { prefix: '/rates', roles: ['FINANCE_ADMIN'] },
  { prefix: '/wallets', roles: ['FINANCE_ADMIN'] },
  { prefix: '/trading', roles: ['FINANCE_ADMIN'] },
  { prefix: '/reports', roles: ['FINANCE_ADMIN', 'COMPLIANCE_ADMIN'] },

  { prefix: '/support', roles: ['SUPPORT_ADMIN'] },
  { prefix: '/tickets', roles: ['SUPPORT_ADMIN'] },
  { prefix: '/contacts', roles: ['SUPPORT_ADMIN'] },
  { prefix: '/smartsupp', roles: ['SUPPORT_ADMIN'] },
  { prefix: '/notifications', roles: ['SUPPORT_ADMIN'] },
];

function normalizePath(path: string): string {
  if (!path || path === '/') return '/';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function matchesPrefix(path: string, prefix: string): boolean {
  if (prefix.includes('/:id/')) {
    const [before, after] = prefix.split('/:id/');
    return path.startsWith(`${before}/`) && path.includes(`/${after}`);
  }
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function allowedRolesForAdminRequest(path: string, method: string): readonly AdminRole[] | null {
  const normalizedPath = normalizePath(path);
  const normalizedMethod = method.toUpperCase();
  if (PUBLIC_ADMIN_PATHS.has(normalizedPath)) return null;

  const rule = RULES.find(candidate =>
    matchesPrefix(normalizedPath, candidate.prefix)
    && (!candidate.methods || candidate.methods.includes(normalizedMethod)),
  );

  // No rule means SUPER_ADMIN only. Empty roles also intentionally means
  // SUPER_ADMIN only for especially sensitive operations such as RBAC edits.
  return rule?.roles ?? [];
}

export function requireAdminAuthorization(req: Request, res: Response, next: NextFunction): void {
  const allowedRoles = allowedRolesForAdminRequest(req.path, req.method);
  if (allowedRoles === null) {
    next();
    return;
  }

  const session = req.adminSession;
  if (!session) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (session.role === 'SUPER_ADMIN' || allowedRoles.includes(session.role)) {
    next();
    return;
  }

  res.status(403).json({
    error: 'Insufficient administrator permission',
    code: 'ADMIN_ROLE_FORBIDDEN',
  });
}
