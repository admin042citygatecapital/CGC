import type { Request, Response } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getSecret } from '#runtime/secrets';
import { isDatabaseConfigured, testConnection } from '../../../db/db.js';
import { mediaAssetRoot, privateSubdirectory } from '../../../lib/storagePaths.js';

interface StoreStats {
  exists: boolean;
  sizeBytes: number;
  lineCount: number;
  lastModified: string | null;
}

function inspectJsonl(filePath: string): StoreStats {
  try {
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    return {
      exists: true,
      sizeBytes: stat.size,
      lineCount: lines.length,
      lastModified: stat.mtime.toISOString(),
    };
  } catch {
    return { exists: false, sizeBytes: 0, lineCount: 0, lastModified: null };
  }
}

function countDir(dirPath: string): number {
  try {
    return fs.readdirSync(dirPath).length;
  } catch {
    return 0;
  }
}

export default async function handler(_req: Request, res: Response) {
  const uptime   = process.uptime();
  const memUsage = process.memoryUsage();
  const database = isDatabaseConfigured()
    ? await testConnection()
    : { ok: false, error: 'DATABASE_URL is not configured' };
  const resendConfigured = Boolean(getSecret('RESEND_API_KEY'));
  const zohoConfigured = Boolean(
    getSecret('ZOHO_CLIENT_ID') && getSecret('ZOHO_CLIENT_SECRET') && getSecret('ZOHO_REFRESH_TOKEN')
  );
  const emailConfigured = resendConfigured || zohoConfigured;
  const memoryWarning = memUsage.heapUsed / Math.max(memUsage.heapTotal, 1) >= 0.85;

  // Deep store inspection
  const adminDir = privateSubdirectory('admin');
  const usersDir = privateSubdirectory('users');
  const stores = {
    users:        inspectJsonl(path.join(usersDir, 'users.jsonl')),
    loginLog:     inspectJsonl(path.join(adminDir, 'login-log.jsonl')),
    accessLog:    inspectJsonl(path.join(adminDir, 'access-log.jsonl')),
    sessions:     inspectJsonl(path.join(adminDir, 'sessions.json')),   // JSON object, not JSONL
    contacts:     inspectJsonl(path.join(privateSubdirectory('contacts'), 'submissions.jsonl')),
    accounts:     inspectJsonl(path.join(privateSubdirectory('accounts'), 'applications.jsonl')),
    newsletter:   inspectJsonl(path.join(privateSubdirectory('newsletter'), 'subscribers.jsonl')),
    cmsContent:   inspectJsonl(path.join(adminDir, 'cms.json')),
    adminSettings:inspectJsonl(path.join(adminDir, 'settings.json')),
  };

  const assetDirs = {
    publicAssets: countDir(mediaAssetRoot),
    privateAdmin: countDir(adminDir),
    privateUsers: countDir(usersDir),
  };

  // Session count from store file — sessions.json (not .jsonl)
  let activeSessions = 0;
  try {
    const raw = fs.readFileSync(path.join(adminDir, 'sessions.json'), 'utf-8');
    const sessionsObj = JSON.parse(raw) as Record<string, { lastSeenAt?: string; createdAt: string }>;
    const now = Date.now();
    const INACTIVITY_MS = 60 * 60_000; // 60 min
    activeSessions = Object.values(sessionsObj).filter(s => {
      const lastSeen = s.lastSeenAt ?? s.createdAt;
      return now - new Date(lastSeen).getTime() < INACTIVITY_MS;
    }).length;
  } catch { /* no sessions yet */ }

  // User counts
  let userStats = { total: 0, verified: 0, pending: 0, suspended: 0 };
  try {
    const raw = fs.readFileSync(path.join(usersDir, 'users.jsonl'), 'utf-8');
    const users = raw.split('\n').filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    userStats = {
      total:     users.length,
      verified:  users.filter((u: Record<string, unknown>) => u.emailVerified).length,
      pending:   users.filter((u: Record<string, unknown>) => u.kycStatus === 'pending').length,
      suspended: users.filter((u: Record<string, unknown>) => u.status === 'suspended').length,
    };
  } catch { /* no users yet */ }

  res.status(200).json({
    status: database.ok ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
    environment: process.env.NODE_ENV ?? 'development',
    uptime: {
      seconds: Math.floor(uptime),
      human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
    },
    memory: {
      heapUsedMb:   Math.round(memUsage.heapUsed  / 1024 / 1024),
      heapTotalMb:  Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMb:        Math.round(memUsage.rss       / 1024 / 1024),
      freeRamMb:    Math.round(os.freemem()  / 1024 / 1024),
      totalRamMb:   Math.round(os.totalmem() / 1024 / 1024),
    },
    database: {
      ok: database.ok,
      latencyMs: database.latencyMs ?? null,
      provider: 'postgresql',
    },
    email: {
      configured: emailConfigured,
      provider: resendConfigured ? 'Resend' : zohoConfigured ? 'Zoho fallback' : 'Not configured',
    },
    checks: {
      api: 'PASS',
      database: database.ok ? 'PASS' : 'FAIL',
      email: emailConfigured ? 'PASS' : 'WARN',
      memory: memoryWarning ? 'WARN' : 'PASS',
    },
    stores,
    assetDirs,
    runtime: {
      activeSessions,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
    },
    users: userStats,
  });
}
