import crypto from 'node:crypto';
import { readWorkflowControls } from './configStore.js';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/db.js';
import { auditLog, onboardingCases, onboardingEvents, users } from '../db/schema.js';
import { sendApplicationUnderReviewEmail, sendKycMoreInformationEmail, sendKycRejectedEmail, sendKycReviewApprovedEmail } from './emailService.js';
import { createNotification } from './notificationStore.js';
import { assertMakerChecker, getOnboardingCaseBundle, type OnboardingStatus } from './onboardingStore.js';
import { assertProviderVerificationComplete } from './onboardingProviderStore.js';
import { sanitizeNote } from './inputValidator.js';
import type { KycDocumentKind } from './kycPrivateStore.js';

const REVIEWABLE = new Set(['submitted', 'under_review', 'needs_info']);
const DECISIONS = new Set<OnboardingStatus>(['under_review', 'needs_info', 'approved', 'rejected']);
const REASON_CODES = new Set(['unreadable', 'expired_doc', 'name_mismatch', 'wrong_type', 'missing_document', 'provider_review', 'fraud', 'other']);
const EVIDENCE_KINDS = new Set<KycDocumentKind>(['identity_front', 'identity_back', 'proof_of_address', 'additional']);

export interface KycReviewInput {
  caseId: string;
  decision: OnboardingStatus;
  reason: string;
  reasonCode?: string;
  requestedEvidenceKinds?: string[];
  expectedVersion: number;
  adminId: string;
  adminEmail: string;
  adminRole: string;
  ip?: string;
  requestId?: string;
}

export async function decideKycCase(input: KycReviewInput) {
  if (input.decision === 'approved' && (await readWorkflowControls()).kycApprovalsEnabled !== true) {
    throw Object.assign(new Error('KYC approvals are disabled. A super admin can enable them in Configuration > Feature Toggles. Production provider evidence is still required.'), { code: 'KYC_APPROVALS_DISABLED' });
  }
  if (!DECISIONS.has(input.decision)) throw Object.assign(new Error('Invalid KYC review decision.'), { code: 'INVALID_DECISION' });
  const reason = sanitizeNote(input.reason).slice(0, 1000);
  if (reason.length < 10) throw Object.assign(new Error('Review rationale must be between 10 and 1,000 characters.'), { code: 'INVALID_REASON' });
  const reasonCode = String(input.reasonCode ?? 'other');
  if (!REASON_CODES.has(reasonCode)) throw Object.assign(new Error('A valid review reason code is required.'), { code: 'INVALID_REASON_CODE' });
  const requestedEvidenceKinds = [...new Set(input.requestedEvidenceKinds ?? [])];
  if (requestedEvidenceKinds.some(kind => !EVIDENCE_KINDS.has(kind as KycDocumentKind))) {
    throw Object.assign(new Error('Requested evidence contains an invalid document kind.'), { code: 'INVALID_EVIDENCE_KIND' });
  }
  if (input.decision === 'needs_info' && requestedEvidenceKinds.length === 0) {
    throw Object.assign(new Error('Requesting more information requires at least one evidence kind.'), { code: 'EVIDENCE_KIND_REQUIRED' });
  }
  const bundle = await getOnboardingCaseBundle(input.caseId);
  if (!bundle) throw Object.assign(new Error('Onboarding case not found.'), { code: 'NOT_FOUND' });
  if (!REVIEWABLE.has(bundle.case.status)) throw Object.assign(new Error('Case is not reviewable in its current status.'), { code: 'INVALID_TRANSITION' });
  // A byte-identical re-decision (e.g. under_review with the same rationale)
  // must not bump the version or re-send the customer email; the same status
  // with a new rationale is a legitimate re-decision and proceeds.
  if (bundle.case.status === input.decision && (bundle.case.reviewReason ?? '') === reason) {
    throw Object.assign(new Error('The case already carries this status with the same rationale; nothing to decide.'), { code: 'NO_OP_DECISION' });
  }
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion !== bundle.case.version) {
    throw Object.assign(new Error('The KYC case changed. Refresh it before reviewing.'), { code: 'WORKFLOW_CONFLICT' });
  }
  assertMakerChecker(bundle.case, input.adminId);
  if (input.decision === 'approved') {
    try {
      if (input.adminRole !== 'super_admin') {
        await assertProviderVerificationComplete(input.caseId, bundle.case.caseType);
      }
    } catch (error) {
      const typed = error as Error & { code?: string };
      throw Object.assign(new Error('An approved KYC provider must confirm identity, liveness, sanctions, PEP, and adverse-media screening before approval.'), {
        code: 'PROVIDER_VERIFICATION_REQUIRED', cause: typed,
      });
    }
  }

  const requestId = input.requestId || crypto.randomUUID();
  const now = new Date();
  const nextVersion = bundle.case.version + 1;
  const result = await getDb().transaction(async tx => {
    const updatedCases = await tx.update(onboardingCases).set({
      status: input.decision,
      reviewedBy: input.adminId,
      reviewedAt: now,
      reviewReason: reason,
      requestedEvidenceKinds: input.decision === 'needs_info' ? requestedEvidenceKinds as KycDocumentKind[] : [],
      customerInstructions: input.decision === 'needs_info' ? reason : null,
      version: nextVersion,
      updatedAt: now,
    }).where(and(
      eq(onboardingCases.id, input.caseId),
      eq(onboardingCases.status, bundle.case.status),
      eq(onboardingCases.version, bundle.case.version),
    )).returning();
    if (!updatedCases[0]) throw Object.assign(new Error('The KYC case changed. Refresh it before reviewing.'), { code: 'WORKFLOW_CONFLICT' });

    const userPatch = input.decision === 'approved'
      ? { status: 'pending_approval' as const, kycStatus: 'approved' as const, kycApprovedAt: now, kycReviewedBy: input.adminId, kycReviewReason: reason, amlStatus: 'cleared' as const, amlRiskLevel: 'low' as const, amlReviewedAt: now, amlReviewedBy: `provider:${bundle.providerVerifications.events.at(-1)?.providerCode ?? 'approved'}`, amlReviewReason: 'Approved provider screening clear', updatedAt: now }
      : input.decision === 'rejected'
        ? { status: 'rejected' as const, kycStatus: 'rejected' as const, kycRejectedAt: now, kycRejectionReason: reason, rejectedAt: now, rejectedBy: input.adminId, rejectionReason: reason, updatedAt: now }
        : input.decision === 'needs_info'
          ? { status: 'pending_kyc' as const, kycStatus: 'submitted' as const, amlStatus: 'not_screened' as const, amlRiskLevel: 'unrated' as const, updatedAt: now }
          : { updatedAt: now };
    const updatedUsers = await tx.update(users).set(userPatch).where(eq(users.id, bundle.case.userId)).returning({ id: users.id, email: users.email, name: users.name });
    if (!updatedUsers[0]) throw Object.assign(new Error('Customer not found.'), { code: 'NOT_FOUND' });

    await tx.insert(onboardingEvents).values({
      id: `oe_${crypto.randomBytes(10).toString('hex')}`, caseId: input.caseId, userId: bundle.case.userId,
      action: 'case_reviewed', actorId: input.adminId, actorType: 'admin',
      fromStatus: bundle.case.status, toStatus: input.decision,
      details: { reason, reasonCode, requestedEvidenceKinds, previousVersion: bundle.case.version, version: nextVersion, requestId }, createdAt: now,
    });
    await tx.insert(auditLog).values({
      id: `al_${crypto.randomBytes(8).toString('hex')}`, adminId: input.adminId, adminEmail: input.adminEmail,
      action: `admin_kyc_${input.decision}`, target: 'onboarding_case', targetId: input.caseId,
      details: { role: input.adminRole, userId: bundle.case.userId, reason, reasonCode, requestId, result: 'success', before: bundle.case.status, after: input.decision, requestedEvidenceKinds },
      ip: input.ip ?? null, ts: now,
    });
    return { case: updatedCases[0], customer: updatedUsers[0] };
  });

  const deliveries: Promise<unknown>[] = [
    createNotification(bundle.case.userId, `Identity review ${input.decision.replace('_', ' ')}`,
      input.decision === 'approved' ? 'Your identity review is complete. Final account activation remains pending.' : reason, '/kyc'),
  ];
  if (input.decision === 'under_review') deliveries.push(sendApplicationUnderReviewEmail(result.customer.email, result.customer.name));
  if (input.decision === 'needs_info') deliveries.push(sendKycMoreInformationEmail(result.customer.email, result.customer.name, reason));
  if (input.decision === 'rejected') deliveries.push(sendKycRejectedEmail(result.customer.email, result.customer.name, reason));
  if (input.decision === 'approved') deliveries.push(sendKycReviewApprovedEmail(result.customer.email, result.customer.name));
  const deliveryResults = await Promise.allSettled(deliveries);
  const deliveryFailures = deliveryResults.filter(delivery => delivery.status === 'rejected').length;
  if (deliveryFailures > 0) {
    console.warn(JSON.stringify({ event: 'kyc.review.delivery_failed', caseId: input.caseId, requestId, deliveryFailures }));
  }
  return { ...result, deliveryFailures };
}
