import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Vercel runtime boundary', () => {
  it('exports the existing Express application from a catch-all API function', () => {
    const handler = readFileSync('api/[...path].ts', 'utf8');
    expect(handler).toContain("export { default } from '../src/server/entry.js'");
  });

  it('does not start standalone lifecycle features in a Vercel function', () => {
    const entry = readFileSync('src/server/entry.ts', 'utf8');
    expect(entry).toContain("const isVercelRuntime = process.env.VERCEL === '1'");
    expect(entry).toContain('const isStandaloneEntrypoint = Boolean(');
    expect(entry).toContain('if (isStandaloneEntrypoint && !isVercelRuntime)');
    expect(entry.indexOf('if (isStandaloneEntrypoint && !isVercelRuntime)')).toBeLessThan(entry.indexOf('new WebSocketServer'));
    expect(entry.indexOf('if (isStandaloneEntrypoint && !isVercelRuntime)')).toBeLessThan(entry.indexOf('startOperationalBackupWorker()'));
  });

  it('builds the Vite client and preserves SPA deep links', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      buildCommand: string;
      outputDirectory: string;
      rewrites: Array<{ source: string; destination: string }>;
    };
    expect(config.buildCommand).toBe('npm run build:vercel');
    expect(config.outputDirectory).toBe('dist/client');
    expect(config.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' });
  });
});
