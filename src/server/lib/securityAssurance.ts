export interface SecurityProbe {
  name: string;
  passed: boolean;
  observed: string;
  requirement: string;
}

export function evaluatePublicSecurityHeaders(headers: Headers): SecurityProbe[] {
  const value = (name: string) => headers.get(name) ?? '';
  const csp = value('content-security-policy');
  const hsts = value('strict-transport-security');
  const permissions = value('permissions-policy');
  return [
    { name: 'hsts', passed: /max-age=(?:[3-9]\d{7}|\d{9,})/i.test(hsts) && /includeSubDomains/i.test(hsts), observed: hsts || 'missing', requirement: 'Long-lived HSTS including subdomains' },
    { name: 'csp_default', passed: /default-src\s+'self'/i.test(csp), observed: csp || 'missing', requirement: "CSP default-src 'self'" },
    { name: 'csp_objects', passed: /object-src\s+'none'/i.test(csp), observed: csp || 'missing', requirement: "CSP object-src 'none'" },
    { name: 'frame_protection', passed: /frame-ancestors\s+'none'/i.test(csp) && value('x-frame-options').toUpperCase() === 'DENY', observed: `${value('x-frame-options') || 'missing'}; ${csp || 'CSP missing'}`, requirement: 'CSP frame-ancestors none and X-Frame-Options DENY' },
    { name: 'mime_sniffing', passed: value('x-content-type-options').toLowerCase() === 'nosniff', observed: value('x-content-type-options') || 'missing', requirement: 'X-Content-Type-Options nosniff' },
    { name: 'referrer_policy', passed: ['no-referrer','strict-origin','strict-origin-when-cross-origin'].includes(value('referrer-policy').toLowerCase()), observed: value('referrer-policy') || 'missing', requirement: 'Restrictive referrer policy' },
    { name: 'permissions_policy', passed: ['camera','microphone','geolocation','payment'].every(feature => new RegExp(`${feature}=\\(\\)`, 'i').test(permissions)), observed: permissions || 'missing', requirement: 'Camera, microphone, geolocation and payment disabled' },
  ];
}

export function protectedEndpointProbe(name: string, status: number): SecurityProbe {
  return { name, passed: status === 401 || status === 403, observed: `HTTP ${status}`, requirement: 'Unauthenticated request rejected with 401 or 403' };
}

export function assertSafeBaselineTarget(raw: string): URL {
  const url = new URL(raw);
  const loopback = ['localhost','127.0.0.1','::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !loopback) throw new Error('Security baseline targets must use HTTPS unless they are loopback addresses.');
  if (url.username || url.password || url.search || url.hash) throw new Error('Security baseline URL must not contain credentials, query parameters or fragments.');
  return url;
}
