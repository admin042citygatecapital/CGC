/**
 * GET /api/admin/smtp/status
 * Returns live SMTP status: mode, OAuth health, queue stats, last delivery.
 * No auth required — used by health monitors and the SMTP panel on load.
 */
import type { Request, Response } from 'express';
import { loadSmtpConfig } from '../../../../lib/smtpConfigStore.js';
import { diagnoseOAuthCredentials, getResolvedAccountId } from '../../../../lib/zohoTokenStore.js';
import { getQueueStats } from '../../../../lib/emailQueue.js';
import { getSecret } from '#runtime/secrets';

export default async function handler(_req: Request, res: Response) {
  const cfg    = loadSmtpConfig();
  const stats  = await getQueueStats();
  const oauthDx = diagnoseOAuthCredentials();

  const oauthReady  = oauthDx.clientSecretValid && oauthDx.refreshTokenValid;
  const manualReady = !!(cfg.host && cfg.username && cfg.password);
  const resendReady = !!getSecret('RESEND_API_KEY');
  const senderEmail = String(getSecret('MAIL_FROM_ADDRESS') || cfg.senderEmail);
  const senderName  = String(getSecret('MAIL_FROM_NAME') || cfg.senderName);
  const provider = resendReady ? 'resend' : (oauthReady ? 'zoho' : 'none');
  const mailboxes = {
    noreply: String(getSecret('EMAIL_NOREPLY_ADDRESS') || 'noreply@citygate.capital'),
    support: String(getSecret('EMAIL_SUPPORT_ADDRESS') || 'support@citygate.capital'),
    security: String(getSecret('EMAIL_SECURITY_ADDRESS') || 'security@citygate.capital'),
    compliance: String(getSecret('EMAIL_COMPLIANCE_ADDRESS') || 'compliance@citygate.capital'),
    admin: String(getSecret('EMAIL_ADMIN_ADDRESS') || 'admin@citygate.capital'),
    info: String(getSecret('EMAIL_INFO_ADDRESS') || 'info@citygate.capital'),
  };

  return res.json({
    mode:          cfg.mode,
    provider,
    resendReady,
    oauthReady,
    manualReady,
    // OAuth detail
    hasAccountId:       !!getResolvedAccountId(),
    hasRefreshToken:    oauthDx.hasRefreshToken,
    hasClientSecret:    oauthDx.hasClientSecret,
    clientSecretValid:  oauthDx.clientSecretValid,
    clientSecretReason: oauthDx.clientSecretReason,
    refreshTokenValid:  oauthDx.refreshTokenValid,
    // Manual SMTP detail
    manualHost:    cfg.host || null,
    manualPort:    cfg.port,
    senderEmail,
    senderName,
    mailboxes,
    encryption:    cfg.encryption,
    updatedAt:     cfg.updatedAt,
    updatedBy:     cfg.updatedBy,
    // Queue
    queue: stats,
  });
}
