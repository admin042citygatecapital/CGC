/**
 * Path hardening middleware.
 *
 * Intercepts and rejects requests whose raw URL contains path-traversal
 * sequences, null bytes, or other malformed patterns BEFORE Express
 * normalises the path and before the SPA fallback can serve a 200 shell.
 *
 * Why this is needed:
 *   Express decodes and normalises req.path, so `/../etc/passwd` becomes
 *   `/etc/passwd` and then falls through to the SPA wildcard handler which
 *   returns HTTP 200 (the React shell).  That is not a file-read
 *   vulnerability, but it is a misleading status code and a potential
 *   information-disclosure vector (reveals the SPA is running).
 *
 * Strategy:
 *   1. Inspect req.url (raw, un-normalised) for traversal sequences.
 *   2. Reject with 400 immediately — never reach the SPA fallback.
 *   3. Log the attempt as a security event for the threat dashboard.
 */
import type { Request, Response, NextFunction } from 'express';

/** Patterns that indicate a path-traversal or malformed-URL attempt */
const TRAVERSAL_PATTERNS: RegExp[] = [
  /\.\.[/\\]/,          // ../  or ..\
  /[/\\]\.\./,          // /..  or \..
  /^\.\.$/,             // bare ..
  /\/\.\./,             // /.. anywhere in path
  /\.\.\//,             // ../ anywhere in path
  /%2e%2e/i,            // URL-encoded ..
  /%252e/i,             // double-encoded .
  /\0/,                 // null byte
  /%00/i,               // URL-encoded null byte
  // eslint-disable-next-line no-control-regex -- intentional: detecting a literal null byte is the point of this check.
  /\x00/,               // literal null
];

/** Patterns for obviously malformed or attack-probe URLs */
const MALFORMED_PATTERNS: RegExp[] = [
  /[<>'"`;]/,           // HTML/script injection in path
  /\beval\b/i,          // eval probe
  /\bexec\b/i,          // exec probe
  /\/etc\/passwd/i,     // classic LFI target
  /\/proc\/self/i,      // proc filesystem probe
  /\/windows\/system32/i, // Windows path probe
  /\bwp-admin\b/i,      // WordPress probe (not our stack)
  /\.php$/i,            // PHP probe
  /\.asp(x)?$/i,        // ASP probe
  /\.env$/i,            // .env file probe
  /\.git\//i,           // git directory probe
];

export function pathHardeningMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const raw = req.url ?? '';

  for (const pattern of TRAVERSAL_PATTERNS) {
    if (pattern.test(raw)) {
      console.warn(
        JSON.stringify({
          event:   'security.path_traversal_blocked',
          ip:      req.ip,
          method:  req.method,
          url:     raw,
          pattern: pattern.toString(),
        }),
      );
      res.status(400).json({ error: 'Bad request' });
      return;
    }
  }

  for (const pattern of MALFORMED_PATTERNS) {
    if (pattern.test(raw)) {
      console.warn(
        JSON.stringify({
          event:   'security.malformed_url_blocked',
          ip:      req.ip,
          method:  req.method,
          url:     raw,
          pattern: pattern.toString(),
        }),
      );
      res.status(400).json({ error: 'Bad request' });
      return;
    }
  }

  next();
}
