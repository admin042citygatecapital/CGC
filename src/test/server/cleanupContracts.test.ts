import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

/**
 * Phase 2 cleanup contracts — surgical, test-gated.
 *
 * Recon findings (pinned so regressions fail loudly):
 * - Server logging is already structured JSON (`event:` envelopes); no bare
 *   `console.log` in `src/server/**` or `src/pages/**`.
 * - Every `/api/admin/*` route passes the central chain in `src/server/entry.ts`:
 *   `requireAdminAuth` → `requireAdminAuthorization` → `csrfProtect` →
 *   `auditAdminMutation` (plus `auditAdminDenied` pre-guard).
 * - `BankingModule.tsx` STAT_TARGETS are marketing display constants for the
 *   public homepage (not dashboard financial data) — intentionally kept.
 * - `routes.tsx` page imports all resolve to existing files (no dead routes).
 */
describe('Phase 2 cleanup contracts', () => {
  it('keeps request-handler logging structured JSON (no bare console.log in api/lib)', () => {
    // Structured pattern: console.log(JSON.stringify({event...})) or
    // console.log('dotted.event.name', ...). Bare strings, template literals,
    // and emoji progress logs are only acceptable in CLI/migration tooling
    // (src/server/db/*) — never in request handlers or shared libs.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const rel = path.relative(process.cwd(), full);
        if (rel.startsWith(`src${path.sep}server${path.sep}db${path.sep}`)) continue; // CLI/migration tooling
        const src = fs.readFileSync(full, 'utf8');
        src.split('\n').forEach((line, i) => {
          const m = line.match(/console\.(log|debug|info)\((.*)$/);
          if (!m) return;
          const rest = m[2].trim();
          const structured =
            rest.startsWith('JSON.stringify({') ||
            rest.startsWith('JSON.stringify({ ') ||
            /^'[\w.]+'\s*,/.test(rest) || // 'dotted.event.name', {...}
            /^"[\w.]+"\s*,/.test(rest);
          if (!structured) offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 140)}`);
        });
      }
    };
    walk(path.resolve(process.cwd(), 'src/server/api'));
    walk(path.resolve(process.cwd(), 'src/server/lib'));
    expect(offenders).toEqual([]);
  });

  it('keeps client pages free of bare console.log', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const src = fs.readFileSync(full, 'utf8');
        src.split('\n').forEach((line, i) => {
          if (/console\.(log|debug|info)\(/.test(line)) {
            offenders.push(`${path.relative(process.cwd(), full)}:${i + 1}: ${line.trim().slice(0, 120)}`);
          }
        });
      }
    };
    walk(path.resolve(process.cwd(), 'src/pages'));
    expect(offenders).toEqual([]);
  });

  it('enforces the central admin middleware chain for every /api/admin route', () => {
    const entry = read('src/server/entry.ts');
    // Denied-mutation audit pre-guard + auth + authorization + CSRF + mutation audit.
    expect(entry).toMatch(/app\.use\('\/api\/admin',\s*auditAdminDenied\)/);
    expect(entry).toMatch(/return requireAdminAuth\(req,\s*res,\s*next\)/);
    expect(entry).toMatch(/app\.use\('\/api\/admin',\s*requireAdminAuthorization\)/);
    expect(entry).toMatch(/return csrfProtect\(req,\s*res,\s*next\)/);
    expect(entry).toMatch(/app\.use\('\/api\/admin',\s*auditAdminMutation\)/);
  });

  it('documents BankingModule STAT_TARGETS as intentional marketing constants', () => {
    const banking = read('src/sections/BankingModule.tsx');
    // These feed the public homepage animated counter — not dashboard balances.
    // If a live marketing-stats API ever exists, this test should be updated
    // to assert the binding; until then the constants are intentional.
    expect(banking).toMatch(/const STAT_TARGETS = \[2, 180, 50, 40\]/);
    expect(banking).toMatch(/AnimatedCount/);
  });

  it('resolves every routes.tsx page import to an existing file', () => {
    const routes = read('src/routes.tsx');
    const missing: string[] = [];
    for (const match of routes.matchAll(/import\('(\.\/pages\/[^']+)'\)/g)) {
      const rel = match[1].slice(2); // strip leading './' → 'pages/...'
      const resolved = [`src/${rel}.tsx`, `src/${rel}.ts`].some((c) =>
        fs.existsSync(path.resolve(process.cwd(), c)),
      );
      if (!resolved) missing.push(match[1]);
    }
    expect(missing).toEqual([]);
  });
});
