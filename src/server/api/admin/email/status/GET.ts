/**
 * GET /api/admin/email/status
 * SUPER_ADMIN only.
 * Returns live OAuth credential diagnosis + queue stats + recent email logs.
 */
import type { Request, Response } from 'express';
import { diagnoseOAuthCredentials } from '../../../../lib/zohoTokenStore.js';
import { getQueueStats, getEmailLogs, getPendingQueue } from '../../../../lib/emailQueue.js';
import { loadSmtpConfig } from '../../../../lib/smtpConfigStore.js';
import { getSecret } from '#airo/secrets';

export default async function handler(_req: Request, res: Response) {
  const oauth   = diagnoseOAuthCredentials();
  const smtp    = loadSmtpConfig();
  const resendReady = !!getSecret('RESEND_API_KEY');
  const [stats, pending, logs] = await Promise.all([
    getQueueStats(),
    getPendingQueue(),
    getEmailLogs(50),
  ]);

  const lastFailed = logs.find(log => log.status === 'failed');
  return res.json({
    mode: resendReady ? 'resend' : smtp.mode,
    provider: resendReady ? 'resend' : (smtp.mode === 'oauth' ? 'zoho' : 'smtp'),
    resendReady,
    oauthReady: oauth.clientSecretValid && oauth.refreshTokenValid,
    manualReady: !!(smtp.host && smtp.username && smtp.password),
    hasRefreshToken: oauth.hasRefreshToken,
    hasClientSecret: oauth.hasClientSecret,
    refreshTokenValid: oauth.refreshTokenValid,
    clientSecretValid: oauth.clientSecretValid,
    clientSecretReason: oauth.clientSecretReason,
    queueSize: stats.queued + stats.retrying,
    failedCount: stats.failed,
    lastSentAt: stats.lastSentAt || null,
    lastError: lastFailed?.errorMessage ?? null,
    oauth,
    queue: { stats, pending: pending.slice(0, 20) },
    recentLogs: logs,
  });
}
