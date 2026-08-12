import type { QueuedEmail } from './emailQueue.js';

export type EmailProviderHealthStatus = 'healthy' | 'configured_unverified' | 'degraded';

export interface ProviderVerification {
  status: 'verified' | 'permission_limited' | 'invalid' | 'unavailable' | 'unconfigured';
  detail?: string;
}

export interface EmailProviderHealth {
  status: EmailProviderHealthStatus;
  healthy: boolean;
  evidence: 'live_api' | 'recent_delivery' | 'configuration_only' | 'provider_error' | 'not_configured';
  message: string;
  detail?: string;
  lastSentAt: string | null;
  lastFailureAt: string | null;
}

const RECENT_DELIVERY_WINDOW_MS = 30 * 86_400_000;

function eventTime(log: QueuedEmail): number {
  const value = log.status === 'sent' ? log.sentAt : (log.lastAttemptAt || log.createdAt);
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function assessResendHealth(
  configured: boolean,
  logs: QueuedEmail[],
  verification: ProviderVerification,
  now = Date.now(),
): EmailProviderHealth {
  const sent = logs.filter(log => log.status === 'sent').sort((a, b) => eventTime(b) - eventTime(a))[0];
  const failed = logs.filter(log => log.status === 'failed').sort((a, b) => eventTime(b) - eventTime(a))[0];
  const lastSentMs = sent ? eventTime(sent) : 0;
  const lastFailureMs = failed ? eventTime(failed) : 0;
  const recentSuccessfulDelivery = lastSentMs > now - RECENT_DELIVERY_WINDOW_MS && lastSentMs >= lastFailureMs;
  const timestamps = {
    lastSentAt: sent?.sentAt || null,
    lastFailureAt: failed ? (failed.lastAttemptAt || failed.createdAt) : null,
  };

  if (!configured || verification.status === 'unconfigured') {
    return {
      status: 'degraded', healthy: false, evidence: 'not_configured',
      message: 'Resend is not configured.', ...timestamps,
    };
  }

  if (verification.status === 'verified') {
    return {
      status: 'healthy', healthy: true, evidence: 'live_api',
      message: 'Resend API credentials were verified.', ...timestamps,
    };
  }

  if (recentSuccessfulDelivery) {
    return {
      status: 'healthy', healthy: true, evidence: 'recent_delivery',
      message: 'Recent accepted email delivery confirms the Resend sending key is operational.',
      detail: verification.status === 'permission_limited'
        ? 'The restricted key cannot inspect domains; delivery history is used as operational evidence.'
        : undefined,
      ...timestamps,
    };
  }

  if (verification.status === 'invalid') {
    return {
      status: 'degraded', healthy: false, evidence: 'provider_error',
      message: 'Resend rejected the configured API credential.', detail: verification.detail, ...timestamps,
    };
  }

  return {
    status: 'configured_unverified', healthy: false, evidence: 'configuration_only',
    message: verification.status === 'permission_limited'
      ? 'A restricted Resend key is configured, but no recent accepted delivery is available to verify it.'
      : 'Resend is configured, but provider health could not be verified without sending an email.',
    detail: verification.detail,
    ...timestamps,
  };
}
