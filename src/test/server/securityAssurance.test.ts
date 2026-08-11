import { describe, expect, it } from 'vitest';
import { assertSafeBaselineTarget, evaluatePublicSecurityHeaders, protectedEndpointProbe } from '../../server/lib/securityAssurance.js';

describe('security assurance baseline', () => {
  it('requires HTTPS for non-loopback targets and rejects embedded credentials', () => {
    expect(assertSafeBaselineTarget('https://citygate.capital').origin).toBe('https://citygate.capital');
    expect(assertSafeBaselineTarget('http://127.0.0.1:5173').origin).toBe('http://127.0.0.1:5173');
    expect(() => assertSafeBaselineTarget('http://example.com')).toThrow(/HTTPS/);
    expect(() => assertSafeBaselineTarget('https://user:secret@example.com')).toThrow(/credentials/);
  });

  it('evaluates required browser security headers', () => {
    const headers = new Headers({
      'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
      'content-security-policy': "default-src 'self'; object-src 'none'; frame-ancestors 'none'",
      'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    });
    expect(evaluatePublicSecurityHeaders(headers).every(probe => probe.passed)).toBe(true);
    expect(evaluatePublicSecurityHeaders(new Headers()).every(probe => !probe.passed)).toBe(true);
  });

  it('accepts only authentication rejection responses for protected endpoints', () => {
    expect(protectedEndpointProbe('protected', 401).passed).toBe(true);
    expect(protectedEndpointProbe('protected', 403).passed).toBe(true);
    expect(protectedEndpointProbe('protected', 200).passed).toBe(false);
  });
});
