import type { Request, Response } from 'express';
import fs from 'node:fs';
import os from 'node:os';

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

export default function handler(_req: Request, res: Response) {
  const uptime   = process.uptime();
  const memUsage = process.memoryUsage();

  // Deep store inspection
  const stores = {
    users:        inspectJsonl('/private/users/users.jsonl'),
    loginLog:     inspectJsonl('/private/admin/login-log.jsonl'),
    accessLog:    inspectJsonl('/private/admin/access-log.jsonl'),
    sessions:     inspectJsonl('/private/admin/sessions.json'),   // JSON object, not JSONL
    contacts:     inspectJsonl('/private/contacts/submissions.jsonl'),
    accounts:     inspectJsonl('/private/accounts/applications.jsonl'),
    newsletter:   inspectJsonl('/private/newsletter/subscribers.jsonl'),
    cmsContent:   inspectJsonl('/private/admin/cms.json'),
    adminSettings:inspectJsonl('/private/admin/settings.json'),
  };

  const assetDirs = {
    publicAssets: countDir('/tmp/uploads'),
    privateAdmin: countDir('/private/admin'),
    privateUsers: countDir('/private/users'),
  };

  // Session count from store file — sessions.json (not .jsonl)
  let activeSessions = 0;
  try {
    const raw = fs.readFileSync('/private/admin/sessions.json', 'utf-8');
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
    const raw = fs.readFileSync('/private/users/users.jsonl', 'utf-8');
    const users = raw.split('\n').filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    userStats = {
      total:     users.length,
      verified:  users.filter((u: Record<string, unknown>) => u.emailVerified).length,
      pending:   users.filter((u: Record<string, unknown>) => u.kycStatus === 'pending').length,
      suspended: users.filter((u: Record<string, unknown>) => u.status === 'suspended').length,
    };
  } catch { /* no users yet */ }

  res.status(200).json({
    status: 'ok',
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
