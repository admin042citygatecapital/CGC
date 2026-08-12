/**
 * GET /api/admin/email/status
 * SUPER_ADMIN only.
 * Returns live OAuth credential diagnosis + queue stats + recent email logs.
 */
import type { Request, Response } from 'express';
import { diagnoseOAuthCredentials } from '../../../../lib/zohoTokenStore.js';
import { getQueueStats, getEmailLogs, getPendingQueue } from '../../../../lib/emailQueue.js';
import { loadSmtpConfig } from '../../../../lib/smtpConfigStore.js';
import { getSecret } from '#runtime/secrets';

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
  const lastSent = logs.find(log => log.status === 'sent');
  const lastSentMs = lastSent?.sentAt ? new Date(lastSent.sentAt).getTime() : 0;
  const lastFailedMs = lastFailed?.lastAttemptAt ? new Date(lastFailed.lastAttemptAt).getTime() : 0;
  const recentSuccessfulDelivery = lastSentMs > Date.now() - 30 * 86_400_000 && lastSentMs >= lastFailedMs;
  const providerHealthy = resendReady ? recentSuccessfulDelivery : (
    smtp.mode === 'oauth' ? oauth.clientSecretValid && oauth.refreshTokenValid : !!(smtp.host && smtp.username && smtp.password)
  );
  return res.json({
    mode: resendReady ? 'resend' : smtp.mode,
    provider: resendReady ? 'resend' : (smtp.mode === 'oauth' ? 'zoho' : 'smtp'),
    resendReady,
    providerHealthy,
    healthStatus: providerHealthy ? 'healthy' : resendReady ? 'configured_unverified' : 'degraded',
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
