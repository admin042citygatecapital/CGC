/**
 * GET /api/admin/email/status
 * SUPER_ADMIN only.
 * Returns live OAuth credential diagnosis + queue stats + recent email logs.
 */
import type { Request, Response } from 'express';
import { diagnoseOAuthCredentials } from '../../../../lib/zohoTokenStore.js';
import { getQueueStats, getEmailLogs, getPendingQueue, toEmailDiagnostic } from '../../../../lib/emailQueue.js';
import { loadSmtpConfig } from '../../../../lib/smtpConfigStore.js';
import { getSecret } from '#runtime/secrets';
import { verifyResendProvider } from '../../../../lib/smtpTransport.js';
import { assessResendHealth } from '../../../../lib/emailProviderHealth.js';

export default async function handler(_req: Request, res: Response) {
  const oauth   = diagnoseOAuthCredentials();
  const smtp    = loadSmtpConfig();
  const resendReady = !!getSecret('RESEND_API_KEY');
  const [stats, pending, logs, verification] = await Promise.all([
    getQueueStats(),
    getPendingQueue(),
    getEmailLogs(50),
    resendReady ? verifyResendProvider() : Promise.resolve({ status: 'unconfigured' as const }),
  ]);

  const lastFailed = logs.find(log => log.status === 'failed');
  const resendHealth = assessResendHealth(resendReady, logs, verification);
  const providerHealthy = resendReady ? resendHealth.healthy : (
    smtp.mode === 'oauth' ? oauth.clientSecretValid && oauth.refreshTokenValid : !!(smtp.host && smtp.username && smtp.password)
  );
  return res.json({
    mode: resendReady ? 'resend' : smtp.mode,
    provider: resendReady ? 'resend' : (smtp.mode === 'oauth' ? 'zoho' : 'smtp'),
    resendReady,
    providerHealthy,
    healthStatus: resendReady ? resendHealth.status : (providerHealthy ? 'healthy' : 'degraded'),
    healthEvidence: resendReady ? resendHealth.evidence : 'configuration_only',
    healthMessage: resendReady ? resendHealth.message : undefined,
    healthDetail: resendReady ? resendHealth.detail : undefined,
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
    queue: { stats, pending: pending.slice(0, 20).map(toEmailDiagnostic) },
    recentLogs: logs.map(toEmailDiagnostic),
  });
}
