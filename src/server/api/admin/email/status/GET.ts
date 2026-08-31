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
import type { ProviderVerification } from '../../../../lib/emailProviderHealth.js';
import { getRecentResendDeliveryEvents } from '../../../../lib/resendWebhook.js';
import { authorizeAdminRole } from '../../../../lib/rbacMiddleware.js';

const PROVIDER_CHECK_TIMEOUT_MS = 5_000;

async function verifyResendProviderWithTimeout(): Promise<ProviderVerification> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      verifyResendProvider(),
      new Promise<ProviderVerification>((resolve) => {
        timeout = setTimeout(() => resolve({
          status: 'unavailable',
          detail: 'The provider health check timed out. Queue and delivery records remain available.',
        }), PROVIDER_CHECK_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export default async function handler(req: Request, res: Response) {
  if (!authorizeAdminRole(req, res, 'SUPER_ADMIN')) return;
  const oauth   = diagnoseOAuthCredentials();
  const smtp    = loadSmtpConfig();
  const resendReady = !!getSecret('RESEND_API_KEY');
  const [stats, pending, logs, verification, providerEvents] = await Promise.all([
    getQueueStats(),
    getPendingQueue(),
    getEmailLogs(50),
    resendReady ? verifyResendProviderWithTimeout() : Promise.resolve({ status: 'unconfigured' as const }),
    getRecentResendDeliveryEvents(100),
  ]);

  const lastFailed = logs.find(log => log.status === 'failed');
  const resendHealth = assessResendHealth(resendReady, logs, verification, Date.now(), providerEvents);
  const providerHealthy = resendReady ? resendHealth.healthy : (
    smtp.mode === 'oauth' ? oauth.clientSecretValid && oauth.refreshTokenValid : !!(smtp.host && smtp.username && smtp.password)
  );
  const mailboxes = {
    noreply: String(getSecret('EMAIL_NOREPLY_ADDRESS') || 'noreply@citygate.capital'),
    support: String(getSecret('EMAIL_SUPPORT_ADDRESS') || 'support@citygate.capital'),
    security: String(getSecret('EMAIL_SECURITY_ADDRESS') || 'security@citygate.capital'),
    compliance: String(getSecret('EMAIL_COMPLIANCE_ADDRESS') || 'compliance@citygate.capital'),
    admin: String(getSecret('EMAIL_ADMIN_ADDRESS') || 'admin@citygate.capital'),
    info: String(getSecret('EMAIL_INFO_ADDRESS') || 'info@citygate.capital'),
  };
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
    mailboxes,
    hasRefreshToken: oauth.hasRefreshToken,
    hasClientSecret: oauth.hasClientSecret,
    refreshTokenValid: oauth.refreshTokenValid,
    clientSecretValid: oauth.clientSecretValid,
    clientSecretReason: oauth.clientSecretReason,
    queueSize: stats.queued + stats.retrying,
    failedCount: stats.failed,
    lastSentAt: stats.lastSentAt || null,
    lastError: lastFailed?.errorMessage ?? null,
    webhook: {
      configured: !!getSecret('RESEND_WEBHOOK_SIGNING_SECRET'),
      verifiedEventCount: providerEvents.length,
      lastVerifiedEventAt: providerEvents[0]?.occurredAt ?? null,
      lastVerifiedEventType: providerEvents[0]?.eventType ?? null,
    },
    oauth,
    queue: { stats, pending: pending.slice(0, 20).map(toEmailDiagnostic) },
    recentLogs: logs.map(toEmailDiagnostic),
  });
}
