import type { Response } from 'express';
import { kycIsExpired, readKycSettings, type KycSettings } from './kycStore.js';
import type { UserRecord } from './userStore.js';

export type FinancialAccessCode =
  | 'ACCOUNT_INACTIVE'
  | 'EMAIL_UNVERIFIED'
  | 'KYC_REQUIRED'
  | 'KYC_EVIDENCE_INCOMPLETE'
  | 'KYC_EXPIRED'
  | 'AML_NOT_CLEARED'
  | 'AML_EVIDENCE_INCOMPLETE'
  | 'AML_REVIEW_EXPIRED';

export interface FinancialAccessDecision {
  allowed: boolean;
  code?: FinancialAccessCode;
  message: string;
  kycStatus: UserRecord['kycStatus'];
  amlStatus: UserRecord['amlStatus'];
  amlRiskLevel: UserRecord['amlRiskLevel'];
}

/**
 * Single, fail-closed policy used by customer and administrator financial paths.
 * This is an internal authorization control. It does not perform KYC, sanctions,
 * PEP, adverse-media, or transaction screening and does not replace a provider.
 */
export async function evaluateFinancialAccess(user: UserRecord, suppliedSettings?: KycSettings): Promise<FinancialAccessDecision> {
  const base = {
    kycStatus: user.kycStatus,
    amlStatus: user.amlStatus ?? 'not_screened',
    amlRiskLevel: user.amlRiskLevel ?? 'unrated',
  } as const;

  if (user.status !== 'active') {
    return { allowed: false, code: 'ACCOUNT_INACTIVE', message: 'The customer account is not active.', ...base };
  }
  if (!user.emailVerified) {
    return { allowed: false, code: 'EMAIL_UNVERIFIED', message: 'The customer email address has not been verified.', ...base };
  }
  if (user.kycStatus !== 'approved') {
    return { allowed: false, code: 'KYC_REQUIRED', message: 'KYC must be approved before financial access is allowed.', ...base };
  }
  if (!user.kycApprovedAt) {
    return { allowed: false, code: 'KYC_REQUIRED', message: 'KYC approval is missing its decision timestamp and must be reviewed.', ...base };
  }
  if (!user.kycReviewedBy || !user.kycReviewReason || user.kycReviewReason.trim().length < 10) {
    return { allowed: false, code: 'KYC_EVIDENCE_INCOMPLETE', message: 'KYC approval is missing its accountable reviewer or rationale.', ...base };
  }

  const settings = suppliedSettings ?? await readKycSettings();
  if (kycIsExpired(user, settings)) {
    return { allowed: false, code: 'KYC_EXPIRED', message: 'The customer KYC approval has expired and must be renewed.', ...base };
  }
  if ((user.amlStatus ?? 'not_screened') !== 'cleared') {
    return { allowed: false, code: 'AML_NOT_CLEARED', message: 'AML review must be cleared by an authorised compliance administrator.', ...base };
  }
  if (!user.amlReviewedAt || !user.amlReviewedBy || !user.amlReviewReason || user.amlReviewReason.trim().length < 10 || !user.amlNextReviewAt) {
    return { allowed: false, code: 'AML_EVIDENCE_INCOMPLETE', message: 'The AML clearance record is incomplete and must be reviewed.', ...base };
  }
  if (user.amlNextReviewAt && new Date(user.amlNextReviewAt).getTime() <= Date.now()) {
    return { allowed: false, code: 'AML_REVIEW_EXPIRED', message: 'The AML decision is due for review and must be renewed.', ...base };
  }

  return { allowed: true, message: 'KYC and AML controls permit financial access.', ...base };
}

export async function requireCustomerFinancialAccess(user: UserRecord, res: Response): Promise<boolean> {
  const decision = await evaluateFinancialAccess(user);
  if (decision.allowed) return true;
  res.status(403).json({
    error: decision.message,
    code: decision.code,
    compliance: {
      kycStatus: decision.kycStatus,
      amlStatus: decision.amlStatus,
      amlRiskLevel: decision.amlRiskLevel,
    },
  });
  return false;
}
