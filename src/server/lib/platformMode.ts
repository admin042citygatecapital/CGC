import type { Response } from 'express';
import { LIVE_FINANCIAL_ACTIVITY_IN_SCOPE } from '../../shared/productScope.js';

export const platformMode = (process.env.PLATFORM_MODE ?? 'preview').toLowerCase();
export const isPreviewMode = platformMode !== 'live';

export const LIVE_READINESS_ENV = [
  'TARGET_LAUNCH_JURISDICTION',
  'LEGAL_ENTITY_REGISTRATION',
  'REGULATORY_COUNSEL_APPROVAL_ID',
  'LIVE_COMPLIANCE_APPROVAL_ID',
  'SPONSOR_FINANCIAL_INSTITUTION',
  'PROGRAM_PROVIDER',
  'PROVIDER_CONTRACTS_APPROVAL_ID',
  'KYC_PROVIDER',
  'AML_SCREENING_PROVIDER',
  'SANCTIONS_SCREENING_PROVIDER',
  'TRANSACTION_MONITORING_PROVIDER',
  'LEDGER_PROVIDER',
  'RECONCILIATION_CONTROL_ID',
  'PAYMENT_PROVIDER',
  'CARD_ISSUER_PROCESSOR',
  'CUSTODY_PROVIDER',
  'COMPLIANCE_OFFICER',
  'CUSTOMER_DISCLOSURE_APPROVAL_ID',
  'SECURITY_PENTEST_REPORT_ID',
  'INCIDENT_RESPONSE_APPROVAL_ID',
  'DATA_RETENTION_APPROVAL_ID',
] as const;

export const LIVE_READINESS_FLAGS = [
  'ENABLE_TRANSACTION_MONITORING',
  'ENABLE_SIGNED_PROVIDER_WEBHOOKS',
  'ENABLE_DAILY_RECONCILIATION',
  'ENABLE_MAKER_CHECKER',
  'ENABLE_SANCTIONS_RESCREENING',
] as const;

/**
 * This must remain false until the placeholder ledger mutations have been
 * replaced by contracted provider adapters with reconciliation, idempotency,
 * signed webhooks, and provider-specific integration tests.
 *
 * Deliberately requiring a reviewed code change prevents environment labels
 * alone from turning demonstration routes into purported live transactions.
 */
export const LIVE_PROVIDER_ADAPTERS_IMPLEMENTED = false;
/** Card issuing is outside the current sponsor-readiness package. */
export const LIVE_CARD_ISSUER_ADAPTER_IMPLEMENTED = false;

function developmentLocksAreEnforced(): boolean {
  return process.env.ENFORCE_PREVIEW_LOCKS === '1';
}

export function getLiveFinancialReadinessGaps(): string[] {
  const gaps = LIVE_READINESS_ENV
    .filter(name => !process.env[name]?.trim())
    .map(name => `${name} is not attested`);
  gaps.push(...LIVE_READINESS_FLAGS
    .filter(name => process.env[name] !== '1')
    .map(name => `${name} is not enabled`));
  if (!LIVE_PROVIDER_ADAPTERS_IMPLEMENTED) {
    gaps.push('Reviewed sponsor/provider adapters and a reconciled double-entry ledger are not implemented');
  }
  if (!LIVE_FINANCIAL_ACTIVITY_IN_SCOPE) {
    gaps.push('Live financial activity is outside the sandbox KYC product scope');
  }
  return gaps;
}

/**
 * A live launch requires named, externally approved integrations in addition to
 * the operational switch. These values are readiness attestations, not secrets.
 * Provider adapters must still validate their own credentials and webhooks.
 */
export function hasLiveFinancialReadiness(): boolean {
  return getLiveFinancialReadinessGaps().length === 0;
}

/** Production preview deployments must never accept money-moving requests. */
export function requireFinancialOperations(res: Response): boolean {
  if (process.env.NODE_ENV !== 'production' && !developmentLocksAreEnforced()) return true;
  if (
    platformMode === 'live'
    && process.env.ENABLE_FINANCIAL_OPERATIONS === '1'
    && hasLiveFinancialReadiness()
  ) return true;
  res.status(503).json({
    error: platformMode === 'live'
      ? 'Live financial activity is outside this sandbox KYC product scope.'
      : 'Financial operations are disabled in this sandbox KYC environment.',
    code: platformMode === 'live' ? 'LIVE_READINESS_INCOMPLETE' : 'PREVIEW_MODE',
  });
  return false;
}

/**
 * Card lifecycle mutations require a contracted issuer adapter in addition to
 * the general financial launch gate. Environment values alone cannot enable
 * local card-number generation or mutation of demonstration records.
 */
export function requireCardOperations(res: Response): boolean {
  if (!LIVE_CARD_ISSUER_ADAPTER_IMPLEMENTED) {
    res.status(503).json({
      error: 'Card issuing and lifecycle controls are outside this sandbox KYC product scope.',
      code: 'CARD_ISSUER_ADAPTER_UNAVAILABLE',
    });
    return false;
  }
  return requireFinancialOperations(res);
}

export function requirePaperTrading(res: Response): boolean {
  if (process.env.NODE_ENV !== 'production' && !developmentLocksAreEnforced()) return true;
  if (LIVE_FINANCIAL_ACTIVITY_IN_SCOPE && process.env.ENABLE_PAPER_TRADING === '1') return true;
  res.status(503).json({
    error: 'Paper trading is disabled in this product-preview environment.',
    code: 'PREVIEW_MODE',
  });
  return false;
}

export function requirePublicRegistration(res: Response): boolean {
  if (process.env.NODE_ENV !== 'production' && !developmentLocksAreEnforced()) return true;
  if (process.env.ALLOW_PUBLIC_REGISTRATION === '1') return true;
  res.status(503).json({
    error: 'Public registration is disabled in this product-preview environment.',
    code: 'REGISTRATION_DISABLED',
  });
  return false;
}
