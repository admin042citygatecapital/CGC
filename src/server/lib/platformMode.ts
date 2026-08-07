import type { Response } from 'express';

export const platformMode = (process.env.PLATFORM_MODE ?? 'preview').toLowerCase();
export const isPreviewMode = platformMode !== 'live';

const LIVE_READINESS_ENV = [
  'LIVE_COMPLIANCE_APPROVAL_ID',
  'KYC_PROVIDER',
  'AML_SCREENING_PROVIDER',
  'PAYMENT_PROVIDER',
  'CUSTODY_PROVIDER',
] as const;

/**
 * A live launch requires named, externally approved integrations in addition to
 * the operational switch. These values are readiness attestations, not secrets.
 * Provider adapters must still validate their own credentials and webhooks.
 */
export function hasLiveFinancialReadiness(): boolean {
  return LIVE_READINESS_ENV.every((name) => Boolean(process.env[name]?.trim()))
    && process.env.ENABLE_TRANSACTION_MONITORING === '1'
    && process.env.ENABLE_SIGNED_PROVIDER_WEBHOOKS === '1';
}

/** Production preview deployments must never accept money-moving requests. */
export function requireFinancialOperations(res: Response): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  if (
    platformMode === 'live'
    && process.env.ENABLE_FINANCIAL_OPERATIONS === '1'
    && hasLiveFinancialReadiness()
  ) return true;
  res.status(503).json({
    error: platformMode === 'live'
      ? 'Financial operations are unavailable until production compliance and provider integrations are approved.'
      : 'Financial operations are disabled in this product-preview environment.',
    code: platformMode === 'live' ? 'LIVE_READINESS_INCOMPLETE' : 'PREVIEW_MODE',
  });
  return false;
}

export function requirePaperTrading(res: Response): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  if (process.env.ENABLE_PAPER_TRADING === '1') return true;
  res.status(503).json({
    error: 'Paper trading is disabled in this product-preview environment.',
    code: 'PREVIEW_MODE',
  });
  return false;
}

export function requirePublicRegistration(res: Response): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  if (process.env.ALLOW_PUBLIC_REGISTRATION === '1') return true;
  res.status(503).json({
    error: 'Public registration is disabled in this product-preview environment.',
    code: 'REGISTRATION_DISABLED',
  });
  return false;
}
