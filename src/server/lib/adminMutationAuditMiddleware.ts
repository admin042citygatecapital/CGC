/** Central, metadata-only audit coverage for every authenticated admin write. */
import type { NextFunction, Request, Response } from 'express';
import { appendAudit, appendCriticalAudit } from './auditLog.js';
import { safeParseId } from './inputValidator.js';
import { PUBLIC_ADMIN_PATHS } from './adminAuthorizationMiddleware.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DENIED_STATUS_CODES = new Set([401, 403]);

/**
 * Resource modules mirror the authorization rule groupings so audit viewers can
 * group privileged activity the same way access is granted. Unlisted resources
 * fall back to their own path segment so new routes are never silently
 * unclassified.
 */
const MODULE_BY_SEGMENT: Readonly<Record<string, string>> = {
  'auth': 'auth',
  'security': 'security', 'administrators': 'security',
  'users': 'users', 'customer-relationships': 'users', 'contacts': 'users',
  'kyc': 'compliance', 'kyc-cases': 'compliance', 'applications': 'compliance',
  'onboarding': 'compliance', 'legal-entity': 'compliance', 'assurance-exercises': 'compliance',
  'sponsor-readiness': 'compliance', 'readiness': 'compliance',
  'balance': 'accounts', 'customer-accounts': 'accounts', 'wallets': 'accounts',
  'transactions': 'transactions', 'disputes': 'transactions', 'financial-sandbox': 'transactions',
  'reconciliation': 'reconciliation',
  'cards': 'cards', 'trading': 'trading',
  'support': 'support', 'tickets': 'support',
  'email': 'email', 'newsletter': 'email',
  'cms': 'content', 'website': 'content', 'media': 'content',
  'config': 'config', 'settings': 'config', 'features': 'config', 'documentation': 'config', 'developer': 'config',
  'rates': 'rates',
  'integrations': 'integrations', 'zoho': 'integrations', 'smtp': 'integrations',
  'chatbot': 'integrations', 'social': 'integrations',
  'reports': 'reports', 'audit': 'audit',
  'operations': 'operations', 'notifications': 'operations', 'provider-sandbox': 'operations',
  'stats': 'dashboard', 'search': 'dashboard', 'links': 'dashboard',
  'health': 'health', 'env-report': 'health', 'database': 'health', 'deployments': 'health',
};

/** Route words that contain digits yet are never record identifiers. */
const STATIC_ACTION_SEGMENTS = new Set(['reset-2fa', 'two-fa']);

/** Body fields that may identify the record a mutation targets — ids only, never payload content. */
const BODY_TARGET_ID_KEYS: readonly string[] = [
  'id', 'targetId', 'userId', 'applicationId', 'transactionId', 'caseId',
  'deviceId', 'documentId', 'walletId', 'campaignId', 'ticketId',
  'subscriberId', 'ownerId',
];

function stripQuery(url: string): string {
  return url.split('?')[0];
}

/** Classify the audited surface from the request path, e.g. /api/admin/kyc/queue -> 'compliance'. */
export function adminModuleForPath(path: string): string {
  const segments = stripQuery(path).split('/').filter(Boolean);
  const adminIndex = segments.indexOf('admin');
  const resource = adminIndex >= 0 ? segments[adminIndex + 1] : segments[0];
  if (!resource) return 'platform';
  return MODULE_BY_SEGMENT[resource] ?? resource;
}

/** Prefixed identifiers (usr_, al_, kd_), uuids and numeric ids — static route words never match. */
function isIdLikeSegment(segment: string): boolean {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(segment) || STATIC_ACTION_SEGMENTS.has(segment)) return false;
  if (/^[a-z]{1,8}_[A-Za-z0-9-]+$/i.test(segment)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(segment)) return true;
  return /^\d{1,15}$/.test(segment);
}

/**
 * The identity of the record a request targets, extracted from safe body id
 * fields first and the URL second. Deliberately no request-body snapshots:
 * target identity only, so payloads (and the secrets or PII they can carry)
 * never reach the audit trail.
 */
export function targetIdForAdminRequest(req: Request): string | undefined {
  const body = (req.body ?? {}) as Record<string, unknown>;
  for (const key of BODY_TARGET_ID_KEYS) {
    const value = body[key];
    const parsed = safeParseId(typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value);
    if (parsed) return parsed;
  }
  const segments = stripQuery(req.originalUrl ?? req.path).split('/').filter(Boolean);
  const adminIndex = segments.indexOf('admin');
  if (adminIndex < 0) return undefined;
  // Skip the resource segment itself; the first id-like segment after it is
  // the target, e.g. /api/admin/applications/:id/decision -> :id.
  for (const segment of segments.slice(adminIndex + 2)) {
    if (isIdLikeSegment(segment)) return segment;
  }
  return undefined;
}

export async function auditAdminMutation(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = req.adminSession;
  if (!session || SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const startedAt = Date.now();
  const path = stripQuery(req.originalUrl?.split('?')[0] ?? req.path);
  const module = adminModuleForPath(path);
  const targetId = targetIdForAdminRequest(req);
  // auditAdminDenied is mounted before every guard, so it would record a second
  // admin_api_denied row for any 401/403 this middleware also covered (handlers
  // can still respond 401/403 after the guard chain, e.g. step-up rejections).
  // Marking the request here keeps exactly one audit row per denial.
  res.locals = { ...res.locals, adminMutationAudited: true };
  try {
    await appendCriticalAudit({
      event: 'admin_api_mutation_intent',
      adminId: session.adminId,
      email: session.email,
      ip: req.ip ?? 'unknown',
      target: module,
      targetId,
      meta: { method: req.method.toUpperCase(), path, module, role: session.role },
    });
  } catch {
    res.status(503).json({ error: 'The privileged action could not be recorded and was not executed.', code: 'AUDIT_UNAVAILABLE' });
    return;
  }
  res.once('finish', () => {
    appendAudit({
      event: 'admin_api_mutation',
      adminId: session.adminId,
      email: session.email,
      ip: req.ip ?? 'unknown',
      target: module,
      targetId,
      meta: {
        method: req.method.toUpperCase(),
        path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        module,
        role: session.role,
      },
    });
  });

  next();
}

/**
 * Best-effort audit of denied privileged attempts. Every guard in the chain
 * (auth, authorization, CSRF, network policy) responds 401/403 without calling
 * next(), so auditAdminMutation never observed them and a denied write left no
 * trace. Safe reads are deliberately skipped to keep the log free of denied
 * read noise, and public bootstrap endpoints keep their own auth-audit path.
 * When a request reaches auditAdminMutation it is marked as covered, so a
 * handler-raised 401/403 is recorded once (by the mutation row) rather than
 * twice.
 * Unlike the fail-closed mutation-intent audit this write is deliberately
 * best-effort: a failed audit write must never block or alter the guard's
 * 401/403 response.
 */
export function auditAdminDenied(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (SAFE_METHODS.has(method)) { next(); return; }
  const suffix = req.path.endsWith('/') && req.path.length > 1 ? req.path.slice(0, -1) : req.path || '/';
  if (PUBLIC_ADMIN_PATHS.has(suffix)) { next(); return; }

  const path = stripQuery(req.originalUrl ?? req.path);
  const module = adminModuleForPath(path);
  const targetId = targetIdForAdminRequest(req);
  // Capture the guard's denial reason from its JSON envelope (code or error
  // text) — never the request payload.
  let denyReason: string | undefined;
  const originalJson = res.json.bind(res) as (body: unknown) => Response;
  res.json = (body: unknown) => {
    if (DENIED_STATUS_CODES.has(res.statusCode) && body && typeof body === 'object') {
      const envelope = body as { code?: unknown; error?: unknown };
      denyReason = typeof envelope.code === 'string' ? envelope.code
        : typeof envelope.error === 'string' ? envelope.error : denyReason;
    }
    return originalJson(body);
  };

  res.once('finish', () => {
    if (!DENIED_STATUS_CODES.has(res.statusCode)) return;
    // The mutation audit already owns this request's 401/403 record (see the
    // flag set in auditAdminMutation) — guard-chain denials never reach it.
    if (res.locals?.adminMutationAudited === true) return;
    const session = req.adminSession;
    try {
      appendAudit({
        event: 'admin_api_denied',
        adminId: session?.adminId,
        email: session?.email,
        ip: req.ip ?? 'unknown',
        target: module,
        targetId,
        reason: denyReason ?? (res.statusCode === 401 ? 'unauthenticated' : 'forbidden'),
        meta: {
          method,
          path,
          statusCode: res.statusCode,
          module,
          ...(session?.role ? { role: session.role } : {}),
        },
      });
    } catch {
      // Best effort only — the guard's response has already been sent.
    }
  });
  next();
}
