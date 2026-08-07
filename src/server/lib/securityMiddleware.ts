/**
 * Security middleware: HTTP security headers, HTTPS enforcement,
 * XSS protection, clickjacking prevention, MIME sniffing prevention.
 */
import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

/** Set comprehensive security headers on every response */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking — belt-and-suspenders with CSP frame-ancestors
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // X-XSS-Protection is deprecated in modern browsers — CSP handles XSS protection.
  // Removed to avoid triggering browser quirks in legacy IE/Edge.
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy — restrict powerful APIs
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()',
  );
  // Cross-origin isolation headers
  // COOP: same-origin-allow-popups required for Zoho OAuth popup flow;
  // pure same-origin would close the popup before the callback fires.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  // CORP: same-origin prevents cross-origin resource embedding
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  // COEP: unsafe-none (not require-corp) — require-corp breaks third-party fonts,
  // images, and CDN assets on a public-facing site. Use unsafe-none unless you
  // need SharedArrayBuffer / high-resolution timers (which this site does not).
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');

  // Content Security Policy
  // In production: use a per-request nonce to eliminate unsafe-inline on scripts.
  // In development: keep unsafe-inline so Vite HMR works without nonce injection.
  const isProd = process.env.NODE_ENV === 'production';
  const nonce  = isProd ? crypto.randomBytes(16).toString('base64') : null;

  // Attach nonce to res.locals so SSR render can inject it into inline <script> tags
  if (nonce) res.locals.cspNonce = nonce;

  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}'`
    : `'self' 'unsafe-inline'`;

  // Known external origins used by this application:
  //   - fonts.googleapis.com / fonts.gstatic.com — Google Fonts CSS + woff2
  //   - accounts.zoho.eu / accounts.zoho.com / accounts.zoho.in / accounts.zoho.com.au
  //     — Zoho OAuth token refresh (server-side fetch; listed here for defence-in-depth)
  //   - mail.zoho.com — Zoho Mail REST API (server-side only; listed for defence-in-depth)
  //   - airoapp.ai / airo-assets — platform media/asset CDN
  const ZOHO_ACCOUNTS = [
    'https://accounts.zoho.eu',
    'https://accounts.zoho.com',
    'https://accounts.zoho.in',
    'https://accounts.zoho.com.au',
  ].join(' ');

  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // Google Fonts serves only CSS from googleapis.com — no scripts needed from there.
      `script-src ${scriptSrc}`,
      // unsafe-inline required for Tailwind/Vite-injected inline styles;
      // style nonces would require build-time changes — accepted tradeoff.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Google Fonts woff2 files are served from fonts.gstatic.com
      "font-src 'self' https://fonts.gstatic.com data:",
      // Images: self + data URIs (inline SVG/base64) + blob (canvas exports) +
      // platform asset CDN (airoapp.ai). No wildcard https: — explicit allowlist only.
      "img-src 'self' data: blob: https://*.airoapp.ai https://*.c24.airoapp.ai",
      // XHR/fetch: self + Zoho OAuth endpoints (used by server-side token refresh
      // triggered from the browser admin panel) + platform CDN.
      `connect-src 'self' ${ZOHO_ACCOUNTS} https://mail.zoho.com https://*.airoapp.ai https://*.c24.airoapp.ai`,
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "media-src 'self' blob:",
      "object-src 'none'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      // form-action: self only — prevents form hijacking to external URLs
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  );

  // HSTS — only set in production over HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  next();
}

/** Redirect HTTP → HTTPS in production */
export function enforceHttps(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== 'production') return next();
  const proto = req.headers['x-forwarded-proto'] as string | undefined;
  if (proto && proto !== 'https') {
    return res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
  }
  next();
}

/** Remove X-Powered-By and other fingerprinting headers */
export function removeFingerprinting(_req: Request, res: Response, next: NextFunction) {
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  next();
}

/**
 * Basic request size guard — reject oversized bodies early.
 * Handles both Content-Length header and chunked transfer encoding.
 */
export function requestSizeGuard(maxKb = 512) {
  const maxBytes = maxKb * 1024;
  return (req: Request, res: Response, next: NextFunction) => {
    // Reject by Content-Length header before body is read
    const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
    if (!isNaN(contentLength) && contentLength > maxBytes) {
      return res.status(413).json({ error: 'Request entity too large' });
    }
    // For chunked transfers: accumulate and abort if over limit
    if (req.headers['transfer-encoding'] === 'chunked') {
      let received = 0;
      req.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > maxBytes) {
          req.destroy();
          if (!res.headersSent) {
            res.status(413).json({ error: 'Request entity too large' });
          }
        }
      });
    }
    next();
  };
}

/**
 * Cache-control headers for API responses.
 * All /api routes are private and must not be cached by CDNs or proxies.
 */
export function apiCacheHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}
