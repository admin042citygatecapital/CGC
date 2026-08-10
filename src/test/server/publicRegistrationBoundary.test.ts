import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('public platform registration boundary', () => {
  it('publishes registration while keeping financial operations disabled', () => {
    const render = readFileSync('render.yaml', 'utf8');
    expect(render).toMatch(/ALLOW_PUBLIC_REGISTRATION\s*\r?\n\s*value: "1"/);
    expect(render).toMatch(/VITE_ALLOW_PUBLIC_REGISTRATION\s*\r?\n\s*value: "1"/);
    expect(render).toMatch(/ENABLE_FINANCIAL_OPERATIONS\s*\r?\n\s*value: "0"/);
  });

  it('requires explicit legal acceptance and records server-controlled versions', () => {
    const route = readFileSync('src/server/api/users/register/POST.ts', 'utf8');
    const page = readFileSync('src/pages/register.tsx', 'utf8');
    expect(route).toContain('raw.termsAccepted === true');
    expect(route).toContain("method: 'explicit_checkbox'");
    expect(route).toContain('termsVersion: TERMS_VERSION');
    expect(route).toContain('privacyVersion: PRIVACY_VERSION');
    expect(page).toContain('termsAccepted: legalAccepted');
    expect(page).toContain('type="checkbox"');
  });

  it('applies a dedicated registration abuse limit before the public route', () => {
    const entry = readFileSync('src/server/entry.ts', 'utf8');
    const limiter = entry.indexOf("app.use('/api/users/register', rateLimitMiddleware(");
    const route = entry.indexOf('app.post("/api/users/register"');
    expect(limiter).toBeGreaterThan(-1);
    expect(route).toBeGreaterThan(limiter);
    expect(entry.slice(limiter, route)).toContain('max: 5');
  });
});
