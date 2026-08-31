import crypto from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/db.js';
import { auditLog, complianceCases, customerSessions, onboardingCases, onboardingEvents, users } from '../db/schema.js';
import { assertProviderVerificationComplete } from './onboardingProviderStore.js';

export interface FinalActivationInput {
  userId: string;
  caseId: string;
  caseType: 'individual' | 'business';
  expectedCaseVersion: number;
  adminId: string;
  adminEmail: string;
  adminRole: string;
  reason: string;
  requestId: string;
  ip?: string;
}

export async function activateCustomerAfterKyc(input: FinalActivationInput) {
  await assertProviderVerificationComplete(input.caseId, input.caseType);
  const now = new Date();
  return getDb().transaction(async tx => {
    const [userRows, caseRows, blockedCases] = await Promise.all([
      tx.select().from(users).where(eq(users.id, input.userId)).limit(1),
      tx.select().from(onboardingCases).where(and(eq(onboardingCases.id, input.caseId), eq(onboardingCases.userId, input.userId))).limit(1),
      tx.select({ id: complianceCases.id }).from(complianceCases).where(and(eq(complianceCases.userId, input.userId), inArray(complianceCases.status, ['open', 'investigating', 'escalated', 'blocked']))).limit(1),
    ]);
    const user = userRows[0];
    const onboardingCase = caseRows[0];
    if (!user || !onboardingCase) throw Object.assign(new Error('Customer onboarding record not found.'), { code: 'NOT_FOUND' });
    if (user.dataClassification === 'synthetic_test') throw Object.assign(new Error('Synthetic production customers cannot be activated for full financial access.'), { code: 'SYNTHETIC_PRODUCTION_ACTIVATION_BLOCKED' });
    if (user.status === 'active') throw Object.assign(new Error('Customer is already active.'), { code: 'ALREADY_ACTIVE' });
    if (onboardingCase.status !== 'approved' || user.kycStatus !== 'approved' || user.amlStatus !== 'cleared') {
      throw Object.assign(new Error('Approved identity review and clear provider screening are required.'), { code: 'KYC_CLEARANCE_REQUIRED' });
    }
    if (!onboardingCase.reviewedBy) throw Object.assign(new Error('A recorded KYC reviewer is required.'), { code: 'KYC_REVIEWER_REQUIRED' });
    if (onboardingCase.version !== input.expectedCaseVersion) throw Object.assign(new Error('The KYC case changed. Refresh before activation.'), { code: 'WORKFLOW_CONFLICT' });
    if (blockedCases[0]) throw Object.assign(new Error('An unresolved compliance case blocks final activation.'), { code: 'COMPLIANCE_CASE_OPEN' });

    const newCredentialVersion = user.credentialVersion + 1;
    const activated = await tx.update(users).set({ status: 'active', approvedAt: now, approvedBy: input.adminId, credentialVersion: newCredentialVersion, updatedAt: now }).where(and(eq(users.id, input.userId), eq(users.credentialVersion, user.credentialVersion))).returning({ id: users.id });
    if (!activated[0]) throw Object.assign(new Error('Customer credentials changed. Refresh before activation.'), { code: 'WORKFLOW_CONFLICT' });
    const revoked = await tx.delete(customerSessions).where(eq(customerSessions.userId, input.userId)).returning({ tokenHash: customerSessions.tokenHash });
    await tx.insert(onboardingEvents).values({
      id: `oe_${crypto.randomBytes(10).toString('hex')}`, caseId: input.caseId, userId: input.userId,
      action: 'customer_finally_activated', actorId: input.adminId, actorType: 'admin', fromStatus: user.status, toStatus: 'active',
      details: { reason: input.reason, role: input.adminRole, requestId: input.requestId, revokedSessionCount: revoked.length, credentialVersion: newCredentialVersion }, createdAt: now,
    });
    await tx.insert(auditLog).values({
      id: `al_${crypto.randomBytes(8).toString('hex')}`, adminId: input.adminId, adminEmail: input.adminEmail,
      action: 'admin_customer_final_activation', target: 'user', targetId: input.userId, ip: input.ip ?? null, ts: now,
      details: { role: input.adminRole, caseId: input.caseId, reason: input.reason, requestId: input.requestId, result: 'success', before: user.status, after: 'active', revokedSessionCount: revoked.length },
    });
    return { customer: { id: user.id, email: user.email, name: user.name }, revokedSessionCount: revoked.length, credentialVersion: newCredentialVersion };
  });
}
