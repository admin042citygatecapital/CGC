/**
 * GET /api/admin/developer
 * Real technical/diagnostic panel data — no fabricated metrics.
 *
 * - routes: derived by parsing entry.ts's own route-registration lines
 *   (the single source of truth for what's actually mounted).
 * - db: real file stats for every flat-file store under /private.
 * - performance: real process/os metrics (uptime, memory, CPU, load avg).
 * - dependencies: real counts from package.json.
 * - errors: real counts from accessLog.ts (httpLogger.ts already records
 *   every request); recentErrors only reflects entries actually logged.
 * - build: real package.json fields + real dist/ existence checks.
 * - deployment: real process/env info.
 * - env: reuses buildEnvReport() (envValidator.ts) — the same data
 *   /api/admin/env-report exposes.
 */
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildEnvReport } from '../../../lib/envValidator.js';
import { accessLogStats, queryAccessLog } from '../../../lib/accessLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This file lives at src/server/api/admin/developer/GET.ts — repo root is 6 levels up.
const REPO_ROOT = path.resolve(__dirname, '../../../../../..');
const ENTRY_TS = path.join(REPO_ROOT, 'src/server/entry.ts');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const PRIVATE_DIR = '/private';
const PUBLIC_DIR = path.join(REPO_ROOT, 'public');
const DIST_DIR = path.join(REPO_ROOT, 'dist');

function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function buildRoutesCatalogue() {
  const catalogue: Array<{ method: string; path: string; group: string; auth: string; description: string }> = [];
  const byGroup: Record<string, number> = {};
  const byMethod: Record<string, number> = {};

  let lines: string[] = [];
  try {
    lines = fs.readFileSync(ENTRY_TS, 'utf8').split('\n');
  } catch { /* entry.ts unreadable — return empty catalogue rather than guessing */ }

  const re = /^app\.(get|post|put|patch|delete)\("([^"]+)",\s*(.*)\);?$/;
  for (const line of lines) {
    const m = re.exec(line.trim());
    if (!m) continue;
    const [, method, routePath, rest] = m;
    const group = routePath.split('/')[2] ?? 'root'; // /api/<group>/...
    let auth = 'public';
    if (rest.includes('requireSuperAdmin')) auth = 'super_admin';
    else if (rest.includes("requireRole(")) {
      const roleMatch = /requireRole\('([^']+)'\)/.exec(rest);
      auth = roleMatch ? roleMatch[1].toLowerCase() : 'role_gated';
    } else if (routePath.startsWith('/api/admin/')) auth = 'admin_session';
    else if (routePath.startsWith('/api/users/')) auth = 'customer_bearer';

    catalogue.push({
      method: method.toUpperCase(),
      path: routePath,
      group,
      auth,
      description: '',
    });
    byGroup[group] = (byGroup[group] ?? 0) + 1;
    byMethod[method.toUpperCase()] = (byMethod[method.toUpperCase()] ?? 0) + 1;
  }

  return { total: catalogue.length, byGroup, byMethod, catalogue };
}

function walkCount(dir: string, exts: string[]): number {
  let count = 0;
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) count += walkCount(full, exts);
    else if (exts.some(ext => e.name.endsWith(ext))) count++;
  }
  return count;
}

function listDataFiles(dir: string): Array<{ name: string; path: string; type: string; rows: number; sizeBytes: number; lastModified: string; healthy: boolean; error?: string }> {
  const results: ReturnType<typeof listDataFiles> = [];
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { results.push(...listDataFiles(full)); continue; }
    if (!e.name.endsWith('.jsonl') && !e.name.endsWith('.json')) continue;
    try {
      const stat = fs.statSync(full);
      const raw = fs.readFileSync(full, 'utf8');
      let rows = 0;
      let healthy = true;
      let error: string | undefined;
      if (e.name.endsWith('.jsonl')) {
        const linesArr = raw.split('\n').filter(Boolean);
        rows = linesArr.length;
        try { for (const l of linesArr) JSON.parse(l); } catch (err) { healthy = false; error = String(err); }
      } else {
        try { const parsed = JSON.parse(raw || '{}'); rows = Array.isArray(parsed) ? parsed.length : 1; }
        catch (err) { healthy = false; error = String(err); }
      }
      results.push({
        name: e.name,
        path: full,
        type: e.name.endsWith('.jsonl') ? 'jsonl' : 'json',
        rows, sizeBytes: stat.size,
        lastModified: stat.mtime.toISOString(),
        healthy, error,
      });
    } catch (err) {
      results.push({ name: e.name, path: full, type: 'unknown', rows: 0, sizeBytes: 0, lastModified: new Date().toISOString(), healthy: false, error: String(err) });
    }
  }
  return results;
}

export default async function handler(_req: Request, res: Response) {
  const now = new Date().toISOString();

  // ── package.json ──────────────────────────────────────────────────────────
  let pkg: { name?: string; version?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string> } = {};
  try { pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')); } catch { /* leave empty */ }

  // ── routes ────────────────────────────────────────────────────────────────
  const routes = buildRoutesCatalogue();

  // ── db (flat-file store health) ──────────────────────────────────────────
  const dbFiles = listDataFiles(PRIVATE_DIR);
  const db = {
    files: dbFiles,
    totalFiles: dbFiles.length,
    healthy: dbFiles.filter(f => f.healthy).length,
    unhealthy: dbFiles.filter(f => !f.healthy).length,
    totalRows: dbFiles.reduce((s, f) => s + f.rows, 0),
    totalBytes: dbFiles.reduce((s, f) => s + f.sizeBytes, 0),
  };

  // ── performance (real process/os metrics) ────────────────────────────────
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const [load1, load5, load15] = os.loadavg();
  const performance = {
    uptime: process.uptime(),
    uptimeHuman: fmtUptime(process.uptime()),
    memoryUsed: mem.heapUsed,
    memoryTotal: mem.heapTotal,
    memoryRss: mem.rss,
    memoryPct: Math.round((mem.heapUsed / mem.heapTotal) * 100),
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model ?? 'unknown',
    loadAvg1m: load1, loadAvg5m: load5, loadAvg15m: load15,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    freeMem, totalMem,
    hostname: os.hostname(),
  };

  // ── dependencies (real package.json) ─────────────────────────────────────
  const deps = pkg.dependencies ?? {};
  const devDeps = pkg.devDependencies ?? {};
  const KEY_DEPS = ['express', 'react', 'react-dom', 'drizzle-orm', 'vite', 'typescript', 'vitest'];
  const dependencies = {
    totalDeps: Object.keys(deps).length,
    totalDevDeps: Object.keys(devDeps).length,
    keyDeps: KEY_DEPS.map(name => ({
      name,
      version: deps[name] ?? devDeps[name] ?? 'not installed',
      isDev: !deps[name] && !!devDeps[name],
      present: !!(deps[name] ?? devDeps[name]),
    })),
    runtimeDeps: Object.entries(deps).map(([name, version]) => ({ name, version })),
  };

  // ── errors (real access-log stats; empty when DB isn't configured) ──────
  const stats = await accessLogStats();
  const { data: recentErrorEntries } = await queryAccessLog({ minStatus: 400, limit: 20 });
  const errors = {
    recentErrors: recentErrorEntries.map(e => ({
      ts: e.ts, type: `${e.status}`, detail: `${e.method} ${e.url}`, ip: e.ip,
    })),
    http5xx: stats.errors5xx,
    http4xx: stats.errors4xx,
    totalRequests: stats.total,
    errorRate: stats.total > 0 ? +(((stats.errors4xx + stats.errors5xx) / stats.total) * 100).toFixed(2) : 0,
  };

  // ── build info ────────────────────────────────────────────────────────────
  const distExists = fs.existsSync(DIST_DIR);
  const distClient = fs.existsSync(path.join(DIST_DIR, 'client'));
  const distServer = fs.existsSync(path.join(DIST_DIR, 'server.bundle.mjs'));
  const build = {
    name: pkg.name ?? 'unknown',
    version: pkg.version ?? '0.0.0',
    nodeVersion: process.version,
    environment: process.env.NODE_ENV ?? 'development',
    distExists, distClient, distServer,
    srcFileCount: walkCount(SRC_DIR, ['.ts', '.tsx']),
    srcPageCount: walkCount(path.join(SRC_DIR, 'pages'), ['.tsx']),
    srcApiCount: walkCount(path.join(SRC_DIR, 'server/api'), ['.ts']),
    totalRoutes: routes.total,
    scripts: Object.entries(pkg.scripts ?? {}).map(([name, command]) => ({ name, command })),
    buildCommand: pkg.scripts?.build ?? '',
    startCommand: pkg.scripts?.start ?? '',
  };

  // ── deployment info ───────────────────────────────────────────────────────
  const deployment = {
    environment: process.env.NODE_ENV ?? 'development',
    appEnv: process.env.APP_ENV ?? 'unknown',
    port: process.env.PORT ?? '3000',
    host: process.env.HOST ?? '0.0.0.0',
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    pid: process.pid,
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    uptime: process.uptime(),
    uptimeHuman: fmtUptime(process.uptime()),
    previewUrl: '',
    productionUrl: '',
    privatePath: PRIVATE_DIR,
    publicPath: PUBLIC_DIR,
    privateExists: fs.existsSync(PRIVATE_DIR),
    publicExists: fs.existsSync(PUBLIC_DIR),
  };

  // ── env validation (reuse the real env report) ──────────────────────────
  const envReport = buildEnvReport();

  return res.json({
    generatedAt: now,
    routes,
    db,
    performance,
    dependencies,
    errors,
    build,
    deployment,
    env: { summary: envReport.summary as unknown as Record<string, number>, variables: envReport.variables },
  });
}
