/**
 * GET /api/admin/smtp/status
 * Returns live SMTP status: mode, OAuth health, queue stats, last delivery.
 * No auth required — used by health monitors and the SMTP panel on load.
 */
import type { Request, Response } from 'express';
import { loadSmtpConfig } from '../../../../lib/smtpConfigStore.js';
import { diagnoseOAuthCredentials, getResolvedAccountId } from '../../../../lib/zohoTokenStore.js';
import { getQueueStats } from '../../../../lib/emailQueue.js';

export default async function handler(_req: Request, res: Response) {
  const cfg    = loadSmtpConfig();
  const stats  = await getQueueStats();
  const oauthDx = diagnoseOAuthCredentials();

  const oauthReady  = oauthDx.clientSecretValid && oauthDx.refreshTokenValid;
  const manualReady = !!(cfg.host && cfg.username && cfg.password);

  return res.json({
    mode:          cfg.mode,
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
    senderEmail:   cfg.senderEmail,
    senderName:    cfg.senderName,
    encryption:    cfg.encryption,
    updatedAt:     cfg.updatedAt,
    updatedBy:     cfg.updatedBy,
    // Queue
    queue: stats,
  });
}
