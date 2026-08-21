import type { Request, Response } from 'express';
import os from 'node:os';
import { getSecret } from '#runtime/secrets';
import { getQueryClient, isDatabaseConfigured, testConnection } from '../../../db/db.js';

interface DatabaseSummary {
  usersTotal: number;
  usersVerified: number;
  usersPendingKyc: number;
  usersSuspended: number;
  activeAdminSessions: number;
  activeCustomerSessions: number;
  operationsTotal: number;
  contactSubmissions: number;
  accountApplications: number;
  newsletterSubscribers: number;
  homepageVersions: number;
  mediaAssets: number;
  emailQueuePending: number;
  emailQueueFailed: number;
  operationsUpdatedAt: Date | null;
  homepageUpdatedAt: Date | null;
  mediaUpdatedAt: Date | null;
}

const emptySummary: DatabaseSummary = {
  usersTotal: 0,
  usersVerified: 0,
  usersPendingKyc: 0,
  usersSuspended: 0,
  activeAdminSessions: 0,
  activeCustomerSessions: 0,
  operationsTotal: 0,
  contactSubmissions: 0,
  accountApplications: 0,
  newsletterSubscribers: 0,
  homepageVersions: 0,
  mediaAssets: 0,
  emailQueuePending: 0,
  emailQueueFailed: 0,
  operationsUpdatedAt: null,
  homepageUpdatedAt: null,
  mediaUpdatedAt: null,
};

async function getDatabaseSummary(): Promise<DatabaseSummary> {
  const rows = await getQueryClient()<DatabaseSummary[]>`
    SELECT
      (SELECT count(*)::int FROM users) AS "usersTotal",
      (SELECT count(*)::int FROM users WHERE email_verified = true) AS "usersVerified",
      (SELECT count(*)::int FROM users WHERE kyc_status IN ('not_submitted', 'submitted')) AS "usersPendingKyc",
      (SELECT count(*)::int FROM users WHERE status IN ('suspended', 'frozen')) AS "usersSuspended",
      (SELECT count(*)::int FROM admin_sessions WHERE expires_at > now() AND last_seen_at > now() - interval '60 minutes') AS "activeAdminSessions",
      (SELECT count(*)::int FROM customer_sessions WHERE expires_at > now()) AS "activeCustomerSessions",
      (SELECT count(*)::int FROM operations_items) AS "operationsTotal",
      (SELECT count(*)::int FROM operations_items WHERE source = 'contact_form') AS "contactSubmissions",
      (SELECT count(*)::int FROM operations_items WHERE source = 'account_application') AS "accountApplications",
      (SELECT count(*)::int FROM subscribers) AS "newsletterSubscribers",
      (SELECT count(*)::int FROM homepage_content_versions) AS "homepageVersions",
      (SELECT count(*)::int FROM media_assets) AS "mediaAssets",
      (SELECT count(*)::int FROM email_queue WHERE status IN ('queued', 'sending')) AS "emailQueuePending",
      (SELECT count(*)::int FROM email_queue WHERE status = 'failed') AS "emailQueueFailed",
      (SELECT max(updated_at) FROM operations_items) AS "operationsUpdatedAt",
      (SELECT max(created_at) FROM homepage_content_versions) AS "homepageUpdatedAt",
      (SELECT max(updated_at) FROM media_assets) AS "mediaUpdatedAt"
  `;
  return rows[0] ?? emptySummary;
}

function managedStore(recordCount: number, lastUpdated: Date | null = null) {
  return {
    mode: 'managed' as const,
    recordCount,
    lastUpdated: lastUpdated?.toISOString() ?? null,
  };
}

export default async function handler(_req: Request, res: Response) {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  const database = isDatabaseConfigured()
    ? await testConnection()
    : { ok: false, error: 'DATABASE_URL is not configured' };

  let summary = emptySummary;
  let summaryAvailable = false;
  if (database.ok) {
    try {
      summary = await getDatabaseSummary();
      summaryAvailable = true;
    } catch {
      summaryAvailable = false;
    }
  }

  const resendConfigured = Boolean(getSecret('RESEND_API_KEY'));
  const zohoConfigured = Boolean(
    getSecret('ZOHO_CLIENT_ID') && getSecret('ZOHO_CLIENT_SECRET') && getSecret('ZOHO_REFRESH_TOKEN')
  );
  const emailConfigured = resendConfigured || zohoConfigured;
  const memoryWarning = memUsage.heapUsed / Math.max(memUsage.heapTotal, 1) >= 0.85;
  const platformHealthy = database.ok && summaryAvailable;

  res.status(200).json({
    status: platformHealthy ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
    environment: process.env.NODE_ENV ?? 'development',
    uptime: {
      seconds: Math.floor(uptime),
      human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
    },
    memory: {
      heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMb: Math.round(memUsage.rss / 1024 / 1024),
      freeRamMb: Math.round(os.freemem() / 1024 / 1024),
      totalRamMb: Math.round(os.totalmem() / 1024 / 1024),
    },
    database: {
      ok: database.ok,
      summaryAvailable,
      latencyMs: database.latencyMs ?? null,
      provider: 'postgresql',
    },
    email: {
      configured: emailConfigured,
      provider: resendConfigured ? 'Resend' : zohoConfigured ? 'Zoho fallback' : 'Not configured',
      queuePending: summary.emailQueuePending,
      queueFailed: summary.emailQueueFailed,
    },
    checks: {
      api: 'PASS',
      database: platformHealthy ? 'PASS' : 'FAIL',
      email: emailConfigured ? 'PASS' : 'WARN',
      memory: memoryWarning ? 'WARN' : 'PASS',
      storage: summaryAvailable ? 'PASS' : 'FAIL',
    },
    stores: {
      customers: managedStore(summary.usersTotal),
      operations: managedStore(summary.operationsTotal, summary.operationsUpdatedAt),
      contacts: managedStore(summary.contactSubmissions, summary.operationsUpdatedAt),
      applications: managedStore(summary.accountApplications, summary.operationsUpdatedAt),
      newsletter: managedStore(summary.newsletterSubscribers),
      homepageVersions: managedStore(summary.homepageVersions, summary.homepageUpdatedAt),
      media: managedStore(summary.mediaAssets, summary.mediaUpdatedAt),
    },
    storage: {
      database: summaryAvailable ? 'managed' : 'unavailable',
      media: summaryAvailable ? 'managed-object-storage' : 'unavailable',
      trackedRecords: summary.usersTotal + summary.operationsTotal + summary.newsletterSubscribers + summary.homepageVersions + summary.mediaAssets,
    },
    runtime: {
      activeSessions: summary.activeAdminSessions + summary.activeCustomerSessions,
      activeAdminSessions: summary.activeAdminSessions,
      activeCustomerSessions: summary.activeCustomerSessions,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
    },
    deployment: {
      gitCommit: process.env.RENDER_GIT_COMMIT ?? 'local',
      gitBranch: process.env.RENDER_GIT_BRANCH ?? 'local',
      serviceIdConfigured: Boolean(process.env.RENDER_SERVICE_ID),
      serviceName: process.env.RENDER_SERVICE_NAME ?? null,
      instanceIdConfigured: Boolean(process.env.RENDER_INSTANCE_ID),
    },
    users: {
      total: summary.usersTotal,
      verified: summary.usersVerified,
      pending: summary.usersPendingKyc,
      suspended: summary.usersSuspended,
    },
  });
}
