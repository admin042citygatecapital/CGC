import type { Request, Response } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import { isDatabaseConfigured, testConnection } from '../../db/db.js';
import { mediaAssetRoot, privateDataRoot } from '../../lib/storagePaths.js';
import { buildCoreHealthComponents, deriveOverallHealth } from '../../lib/healthStatus.js';

// Directories and files that must be accessible for the app to function
const CRITICAL_DIRS = [
  { key: 'customers', path: `${privateDataRoot}/users` },
  { key: 'administration', path: `${privateDataRoot}/admin` },
  { key: 'contacts', path: `${privateDataRoot}/contacts` },
  { key: 'accounts', path: `${privateDataRoot}/accounts` },
  { key: 'media', path: mediaAssetRoot },
];

function checkDir(dir: string): 'ok' | 'error' {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = `${dir}/.healthcheck`;
    fs.writeFileSync(probe, '1');
    fs.unlinkSync(probe);
    return 'ok';
  } catch {
    return 'error';
  }
}

export default async function handler(_req: Request, res: Response) {
  const uptime   = process.uptime();
  const memUsage = process.memoryUsage();
  const freeRam  = os.freemem();
  const totalRam = os.totalmem();
  const loadAvg  = os.loadavg();

  // Storage checks (flat-file fallback)
  const storage: Record<string, 'ok' | 'error'> = {};
  for (const directory of CRITICAL_DIRS) {
    storage[directory.key] = checkDir(directory.path);
  }

  // Database check
  let dbStatus: 'ok' | 'not_configured' | 'error' = 'not_configured';
  let dbLatencyMs: number | undefined;

  if (isDatabaseConfigured()) {
    const result = await testConnection();
    dbStatus    = result.ok ? 'ok' : 'error';
    dbLatencyMs = result.latencyMs;
  }

  // Derived service health
  const services = {
    userStore:    dbStatus === 'ok' ? 'ok' : (storage.customers === 'ok' ? 'ok' : 'error'),
    adminStore:   dbStatus === 'ok' ? 'ok' : (storage.administration === 'ok' ? 'ok' : 'error'),
    contactStore: storage.contacts === 'ok' ? 'ok' : 'error',
    accountStore: storage.accounts === 'ok' ? 'ok' : 'error',
    publicAssets: storage.media === 'ok' ? 'ok' : 'error',
    sessionStore: dbStatus === 'ok' ? 'ok' : (storage.administration === 'ok' ? 'ok' : 'error'),
    auditLog:     dbStatus === 'ok' ? 'ok' : (storage.administration === 'ok' ? 'ok' : 'error'),
    database:     dbStatus,
  };

  const storageOk = Object.values(storage).every(value => value === 'ok');
  const production = process.env.NODE_ENV === 'production';
  const components = buildCoreHealthComponents({
    databaseHealthy: dbStatus === 'ok',
    databaseConfigured: dbStatus !== 'not_configured',
    databaseRequired: production,
    databaseDetail: dbStatus === 'ok'
      ? `PostgreSQL responded in ${dbLatencyMs ?? 0}ms.`
      : dbStatus === 'not_configured' && !production
        ? 'PostgreSQL is not configured; the local storage fallback is active.'
        : 'PostgreSQL is unavailable.',
    storageHealthy: storageOk,
    storageDetail: storageOk ? 'Required runtime storage is accessible.' : 'Required runtime storage is unavailable.',
    sessionsHealthy: services.sessionStore === 'ok',
    sessionsDetail: services.sessionStore === 'ok' ? 'Session persistence is available.' : 'Session persistence is unavailable.',
  });
  const overall = deriveOverallHealth(components);
  const allOk = overall !== 'degraded';
  const status = overall === 'healthy' ? 'ok' : overall;

  res.status(allOk ? 200 : 503).json({
    status,
    timestamp:   new Date().toISOString(),
    version:     process.env.npm_package_version ?? '1.0.0',
    release: {
      commit: process.env.RENDER_GIT_COMMIT ?? 'local',
      branch: process.env.RENDER_GIT_BRANCH ?? 'local',
    },
    environment: process.env.NODE_ENV ?? 'development',
    components,
    uptime: {
      seconds: Math.floor(uptime),
      human:   `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
    },
    memory: {
      heapUsedMb:   Math.round(memUsage.heapUsed  / 1024 / 1024),
      heapTotalMb:  Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMb:        Math.round(memUsage.rss       / 1024 / 1024),
      freeRamMb:    Math.round(freeRam  / 1024 / 1024),
      totalRamMb:   Math.round(totalRam / 1024 / 1024),
      heapUsagePct: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    },
    cpu: {
      load1m:  Math.round(loadAvg[0] * 100) / 100,
      load5m:  Math.round(loadAvg[1] * 100) / 100,
      load15m: Math.round(loadAvg[2] * 100) / 100,
      cores:   os.cpus().length,
    },
    storage,
    database: {
      status:    dbStatus,
      latencyMs: dbLatencyMs,
      provider:  'postgresql',
    },
    services,
    checks: {
      total:  Object.keys(services).length,
      passed: Object.values(services).filter(v => v === 'ok' || v === 'not_configured').length,
      failed: Object.values(services).filter(v => v === 'error').length,
    },
  });
}
