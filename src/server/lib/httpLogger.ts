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
      url:        req.originalUrl.slice(0, 500),
      status,
      duration,
      ip:         (req.ip ?? req.socket?.remoteAddress ?? 'unknown').replace('::ffff:', ''),
      ua:         (req.headers['user-agent'] ?? '').slice(0, 300),
      referer:    (req.headers['referer'] ?? '').slice(0, 200),
      bytes,
      threat:     effectiveThreat,
      threatNote: effectiveNote,
    });
  });

  next();
}
