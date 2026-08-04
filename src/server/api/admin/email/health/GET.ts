/**
 * GET /api/admin/email/health
 * Real transport health for admin/EmailDiagnostics.tsx — OAuth credential
 * state (passive check, no live token exchange), SMTP fallback config
 * completeness, and queue health, all derived from the same primitives
 * admin/email/status/GET.ts already uses. No fabricated statuses.
 */
import type { Request, Response } from 'express';
import { diagnoseOAuthCredentials, getCachedTokenExpiry } from '../../../../lib/zohoTokenStore.js';
import { loadSmtpConfig, getSmtpMode } from '../../../../lib/smtpConfigStore.js';
import { getQueueStats, getEmailLogs } from '../../../../lib/emailQueue.js';

type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export default async function handler(_req: Request, res: Response) {
  try {
    const oauthDiag = diagnoseOAuthCredentials();
    let oauth: HealthStatus;
    if (oauthDiag.hasRefreshToken && oauthDiag.clientSecretValid) oauth = 'healthy';
    else if (oauthDiag.hasRefreshToken || oauthDiag.hasClientSecret) oauth = 'degraded';
    else oauth = 'down';

    const smtpMode = getSmtpMode();
    let smtp: HealthStatus;
    if (smtpMode !== 'manual') {
      smtp = 'unknown'; // SMTP fallback isn't the active transport — nothing to report
    } else {
      const cfg = loadSmtpConfig();
      const configured = !!(cfg.host && cfg.username && cfg.password && cfg.senderEmail);
      smtp = configured ? 'healthy' : 'degraded';
    }

    let queue: HealthStatus = 'unknown';
    let stats: { queued: number; retrying: number; sent: number; failed: number } | null = null;
    try {
      stats = await getQueueStats();
      queue = stats.failed > 0 ? 'degraded' : 'healthy';
    } catch {
      queue = 'down';
    }

    const logs = await getEmailLogs(200);
    const lastSuccessful = logs.find(l => l.status === 'sent');
    const lastFailed = logs.find(l => l.status === 'failed');

    return res.json({
      success: true,
      oauth,
      smtp,
      queue,
      lastSuccessfulEmail: lastSuccessful?.sentAt || lastSuccessful?.lastAttemptAt || null,
      lastFailedEmail: lastFailed?.lastAttemptAt || null,
      tokenExpiry: getCachedTokenExpiry(),
      queueStats: stats,
    });
  } catch (err) {
    console.error('[Admin] email/health error:', err);
    return res.status(500).json({ success: false, error: 'Failed to compute email health' });
  }
}
