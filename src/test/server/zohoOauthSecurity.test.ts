import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import callbackHandler, { escapeHtml } from '../../server/api/zoho/callback/GET.js';

describe('Zoho OAuth callback security', () => {
  it('escapes reflected provider and query-string content', async () => {
    const result: { status: number; body: string } = { status: 200, body: '' };
    const res = {
      status(code: number) { result.status = code; return res; },
      send(body: string) { result.body = body; return res; },
    } as unknown as Response;

    await callbackHandler({
      query: {
        error: 'access_denied',
        error_description: '<img src=x onerror="alert(1)">',
      },
    } as unknown as Request, res);

    expect(result.status).toBe(400);
    expect(result.body).not.toContain('<img');
    expect(result.body).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(escapeHtml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#39;');
  });

  it('never places OAuth credentials in a redirect query string', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/server/api/zoho/callback/GET.ts'),
      'utf8',
    );
    expect(source).not.toContain('?refresh_token=');
    expect(source).not.toContain('encodeURIComponent(refreshToken)');
  });
});
