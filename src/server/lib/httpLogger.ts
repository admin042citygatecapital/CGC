/**
 * httpLogger.ts — Express middleware that records every HTTP request
 * to the access log and runs threat detection.
 *
 * Attach BEFORE routes so it captures all traffic.
 * Skips static assets (/_vite/, /assets/, /favicon) to keep logs clean.
 */
import type { Request, Response, NextFunction } from 'express';
import { appendAccessEntry, detectThreat } from './accessLog.js';

// Paths to skip (static assets, health checks)
const SKIP_PREFIXES = ['/_vite', '/assets/', '/favicon', '/robots.txt', '/sitemap.xml'];

const REDACTED_QUERY_VALUE = '[REDACTED]';
const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'authtoken',
  'bearertoken',
  'verificationtoken',
  'emailverificationtoken',
  'verifytoken',
  'resettoken',
  'passwordresettoken',
  'secret',
  'clientsecret',
  'webhooksecret',
  'password',
  'passwd',
  'passphrase',
  'credential',
  'credentials',
  'authorization',
  'auth',
  'code',
  'authorizationcode',
  'verificationcode',
  'verifycode',
  'resetcode',
  'passwordresetcode',
  'otp',
  'totp',
  'mfacode',
  'passcode',
  'apikey',
  'key',
  'privatekey',
  'signingkey',
  'signature',
  'sig',
  'assertion',
  'samlresponse',
  'state',
  'nonce',
  'challenge',
  'challengeid',
  'codeverifier',
  'session',
  'sessionid',
  'sessiontoken',
  'verification',
  'verify',
  'reset',
  'recovery',
]);

function decodeQueryKey(rawKey: string): string {
  let decoded = rawKey.replace(/\+/g, ' ');
  // Decode twice so encoded separators in a key cannot bypass the boundary.
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

function isSensitiveQueryKey(rawKey: string): boolean {
  const normalized = decodeQueryKey(rawKey).toLowerCase().replace(/[^a-z0-9]/g, '');
  return SENSITIVE_QUERY_KEYS.has(normalized)
    || normalized.endsWith('token')
    || normalized.endsWith('secret')
    || normalized.endsWith('password')
    || normalized.endsWith('credential')
    || normalized.endsWith('signature');
}

function redactParameterString(value: string): string {
  return value.split('&').map((part) => {
    const separatorIndex = part.indexOf('=');
    const rawKey = separatorIndex === -1 ? part : part.slice(0, separatorIndex);
    if (!isSensitiveQueryKey(rawKey)) return part;
    return `${rawKey}=${REDACTED_QUERY_VALUE}`;
  }).join('&');
}

/** Redact credential-like query and fragment values before persisting a URL. */
export function redactHttpLogUrl(rawUrl: string): string {
  const hashIndex = rawUrl.indexOf('#');
  const beforeFragment = hashIndex === -1 ? rawUrl : rawUrl.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : rawUrl.slice(hashIndex + 1);
  const queryIndex = beforeFragment.indexOf('?');
  const path = queryIndex === -1 ? beforeFragment : beforeFragment.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : beforeFragment.slice(queryIndex + 1);
  const redactedQuery = queryIndex === -1 ? '' : `?${redactParameterString(query)}`;
  const redactedFragment = hashIndex === -1 ? '' : `#${redactParameterString(fragment)}`;
  return `${path}${redactedQuery}${redactedFragment}`;
}

export function httpLogger(req: Request, res: Response, next: NextFunction) {
  // Skip static assets
  if (SKIP_PREFIXES.some(p => req.path.startsWith(p))) return next();

  const startMs = Date.now();

  // Capture body for threat analysis (already parsed by express.json)
  const bodyStr = req.body && typeof req.body === 'object'
    ? JSON.stringify(req.body).slice(0, 2000)
    : '';

  // Detect threats before response
  const { threat, note: threatNote } = detectThreat(
    req.method,
    req.originalUrl,
    req.headers['user-agent'] ?? '',
    bodyStr,
  );

  // Hook into response finish to capture status + duration
  res.on('finish', () => {
    const duration = Date.now() - startMs;
    const status   = res.statusCode;
    const bytes    = parseInt(res.getHeader('content-length') as string ?? '0', 10) || 0;

    // Determine effective threat — also flag 401/403 on admin routes
    let effectiveThreat = threat;
    let effectiveNote   = threatNote;
    if (effectiveThreat === 'none' && (status === 401 || status === 403) && req.path.startsWith('/api/admin')) {
      effectiveThreat = 'unauthorized_admin';
      effectiveNote   = `Unauthorized admin access: ${status}`;
    }
    if (effectiveThreat === 'none' && status === 429) {
      effectiveThreat = 'rate_limited';
      effectiveNote   = 'Rate limit exceeded';
    }

    appendAccessEntry({
      method:     req.method,
      url:        redactHttpLogUrl(req.originalUrl).slice(0, 500),
      status,
      duration,
      ip:         (req.ip ?? req.socket?.remoteAddress ?? 'unknown').replace('::ffff:', ''),
      ua:         (req.headers['user-agent'] ?? '').slice(0, 300),
      referer:    redactHttpLogUrl(req.headers['referer'] ?? '').slice(0, 200),
      bytes,
      threat:     effectiveThreat,
      threatNote: effectiveNote,
    });
  });

  next();
}
