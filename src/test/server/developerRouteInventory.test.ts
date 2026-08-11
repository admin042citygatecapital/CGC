import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  classifyRouteAuth,
  getRegisteredRouteCatalogue,
  type DeveloperRouteEntry,
  type ExpressRouteSource,
} from '../../server/lib/developerRouteInventory.js';

describe('Developer Center route inventory', () => {
  it('derives the catalogue from routes registered by the running server', () => {
    const source: ExpressRouteSource = {
      router: {
        stack: [
          { route: { path: '/api/health', methods: { get: true } } },
          { route: { path: '/api/analytics/event', methods: { post: true } } },
          { route: { path: '/api/admin/new-control', methods: { get: true, post: true } } },
          { route: { path: '/not-an-api', methods: { get: true } } },
        ],
      },
    };
    const staleMetadata: DeveloperRouteEntry[] = [
      { method: 'POST', path: '/api/analytics/event', group: 'Analytics', auth: 'public', description: 'Analytics event' },
      { method: 'GET', path: '/api/admin/removed-control', group: 'Admin', auth: 'admin', description: 'Removed route' },
    ];

    const catalogue = getRegisteredRouteCatalogue(source, staleMetadata);

    expect(catalogue.map(route => `${route.method} ${route.path}`)).toEqual([
      'GET /api/admin/new-control',
      'POST /api/admin/new-control',
      'POST /api/analytics/event',
      'GET /api/health',
    ]);
    expect(catalogue.find(route => route.path === '/api/analytics/event')).toMatchObject({ auth: 'public' });
    expect(catalogue.some(route => route.path === '/api/admin/removed-control')).toBe(false);
  });

  it('matches the central authentication boundaries', () => {
    expect(classifyRouteAuth('/api/admin/auth/login')).toBe('public');
    expect(classifyRouteAuth('/api/admin/auth/logout')).toBe('admin');
    expect(classifyRouteAuth('/api/admin/readiness')).toBe('admin');
    expect(classifyRouteAuth('/api/users/login')).toBe('public');
    expect(classifyRouteAuth('/api/users/logout')).toBe('customer');
    expect(classifyRouteAuth('/api/analytics/event')).toBe('public');
    expect(classifyRouteAuth('/api/analytics/summary')).toBe('admin');
    expect(classifyRouteAuth('/api/newsletter/send-sequence')).toBe('admin');
    expect(classifyRouteAuth('/api/zoho/connect')).toBe('admin');
    expect(classifyRouteAuth('/api/zoho/status')).toBe('admin');
    expect(classifyRouteAuth('/api/zoho/callback')).toBe('public');
    expect(classifyRouteAuth('/api/providers/onboarding/webhook/:provider')).toBe('public');
  });

  it('keeps the obsolete unauthenticated email sender out of the server registry', () => {
    const entrySource = fs.readFileSync(path.resolve(process.cwd(), 'src/server/entry.ts'), 'utf8');
    expect(entrySource).not.toContain('/api/test-email');
    expect(fs.existsSync(path.resolve(process.cwd(), 'src/server/api/test-email/POST.ts'))).toBe(false);
  });
});
