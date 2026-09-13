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
 * Sessionless denials (the unauthenticated scan traffic this audit exists to
 * catch) are coalesced: one row per (ip, method, path, status) per short
 * window, carrying an attempts count. Without this a bot sweep writes one
 * admin_api_denied row per probed path per request, flooding the compliance
 * table with noise. Authenticated denials keep one row per request — an
 * administrator's individual denial is a distinct security event. The
 * counter is deliberately process-local: restarts merely restart the
 * coalescing window.
 */
const DENIED_COALESCE_WINDOW_MS = 15_000;
/** Key-space bound: a path-sweeping scan could otherwise grow the map unbounded. */
const MAX_PENDING_DENIED_KEYS = 512;

interface PendingDenial {
  count: number;
  windowStart: number;
  ip: string;
  method: string;
  path: string;
  module: string;
  targetId?: string;
  statusCode: number;
  reason: string | undefined;
}

const pendingDeniedRows = new Map<string, PendingDenial>();

function writeDeniedRow(pending: PendingDenial): void {
  try {
    appendAudit({
      event: 'admin_api_denied',
      ip: pending.ip,
      target: pending.module,
      targetId: pending.targetId,
      reason: pending.reason ?? (pending.statusCode === 401 ? 'unauthenticated' : 'forbidden'),
      meta: {
        method: pending.method,
        path: pending.path,
        statusCode: pending.statusCode,
        module: pending.module,
        attempts: pending.count,
      },
    });
  } catch {
    // Best effort only — the guard's response has already been sent.
  }
}

/** Flush every pending row regardless of window expiry (overflow drain). */
function flushAllPendingDeniedRows(): void {
  // Flush everything, not just expired windows, so the key space itself
  // cannot grow past the cap during a sweep.
  for (const [key, pending] of pendingDeniedRows) {
    pendingDeniedRows.delete(key);
    writeDeniedRow(pending);
  }
}

function flushPendingDeniedRows(): void {
  const now = Date.now();
  if (pendingDeniedRows.size > MAX_PENDING_DENIED_KEYS) {
    flushAllPendingDeniedRows();
    return;
  }
  for (const [key, pending] of pendingDeniedRows) {
    if (now - pending.windowStart < DENIED_COALESCE_WINDOW_MS) continue;
    pendingDeniedRows.delete(key);
    writeDeniedRow(pending);
  }
}

// Mirrors the rate-store sweep idiom: an unref'd interval retires expired
// windows so coalesced rows reach the trail even when no further request for
// that key arrives.
setInterval(flushPendingDeniedRows, DENIED_COALESCE_WINDOW_MS).unref();

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
    if (!session) {
      // Coalesce scan noise (see the window constants above). The first
      // attempt's reason and target stand for the window; the attempts count
      // preserves the full volume of the signal.
      const key = `${req.ip ?? 'unknown'}|${method}|${path}|${res.statusCode}`;
      const now = Date.now();
      const pending = pendingDeniedRows.get(key);
      if (pending && now - pending.windowStart < DENIED_COALESCE_WINDOW_MS) {
        pending.count += 1;
        return;
      }
      // A new key, or one whose window expired between interval sweeps: its
      // previous row (if any) is flushed here, then a fresh window begins.
      if (pending) {
        pendingDeniedRows.delete(key);
        writeDeniedRow(pending);
      }
      // Enforce the key-space cap at insertion too: without this a single
      // burst of unique (ip, method, path, status) keys grows the map
      // unbounded until the next interval sweep.
      if (pendingDeniedRows.size >= MAX_PENDING_DENIED_KEYS) flushAllPendingDeniedRows();
      pendingDeniedRows.set(key, {
        count: 1,
        windowStart: now,
        ip: req.ip ?? 'unknown',
        method,
        path,
        module,
        targetId,
        statusCode: res.statusCode,
        reason: denyReason,
      });
      return;
    }
    try {
      appendAudit({
        event: 'admin_api_denied',
        adminId: session.adminId,
        email: session.email,
        ip: req.ip ?? 'unknown',
        target: module,
        targetId,
        reason: denyReason ?? (res.statusCode === 401 ? 'unauthenticated' : 'forbidden'),
        meta: {
          method,
          path,
          statusCode: res.statusCode,
          module,
          ...(session.role ? { role: session.role } : {}),
        },
      });
    } catch {
      // Best effort only — the guard's response has already been sent.
    }
  });
  next();
}
