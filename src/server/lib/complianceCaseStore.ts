import crypto from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '../db/db.js';
import { complianceCaseEvents, complianceCases } from '../db/schema.js';

export type ComplianceCaseStatus = 'open' | 'investigating' | 'escalated' | 'cleared' | 'blocked';
export type ComplianceCaseKind = 'aml' | 'sanctions';
export type ComplianceRisk = 'unrated' | 'low' | 'medium' | 'high';

async function event(caseId: string, actorId: string, action: string, fromStatus: string | null, toStatus: string | null, details: Record<string, unknown> = {}) {
  await getDb().insert(complianceCaseEvents).values({ id: `ce_${crypto.randomBytes(10).toString('hex')}`, caseId, actorId, action, fromStatus, toStatus, details, createdAt: new Date() });
}

export async function openComplianceCase(input: { userId: string; kind: ComplianceCaseKind; summary: string; riskLevel: ComplianceRisk; actorId: string }) {
  if (input.summary.trim().length < 10 || input.summary.length > 1000) throw new Error('Case summary must be between 10 and 1000 characters.');
  const rows = await getDb().insert(complianceCases).values({
    id: `cc_${crypto.randomBytes(10).toString('hex')}`, userId: input.userId, kind: input.kind, status: 'open', riskLevel: input.riskLevel,
    summary: input.summary.trim(), openedBy: input.actorId, lastEditedBy: input.actorId, createdAt: new Date(), updatedAt: new Date(),
  }).returning();
  await event(rows[0].id, input.actorId, 'case_opened', null, 'open', { kind: input.kind, riskLevel: input.riskLevel });
  return rows[0];
}

export async function transitionComplianceCase(input: { caseId: string; status: ComplianceCaseStatus; riskLevel: ComplianceRisk; reason: string; actorId: string }) {
  if (input.reason.trim().length < 10 || input.reason.length > 1000) throw new Error('Case rationale must be between 10 and 1000 characters.');
  const rows = await getDb().select().from(complianceCases).where(eq(complianceCases.id, input.caseId)).limit(1);
  const current = rows[0];
  if (!current) throw Object.assign(new Error('Compliance case not found.'), { code: 'NOT_FOUND' });
  if (['cleared', 'blocked'].includes(input.status) && (current.openedBy === input.actorId || current.lastEditedBy === input.actorId)) {
    throw Object.assign(new Error('A different compliance administrator must resolve the case.'), { code: 'MAKER_CHECKER_REQUIRED' });
  }
  const now = new Date();
  const updated = await getDb().update(complianceCases).set({
    status: input.status, riskLevel: input.riskLevel, lastEditedBy: input.actorId,
    reviewedBy: ['cleared', 'blocked'].includes(input.status) ? input.actorId : current.reviewedBy,
    reviewedAt: ['cleared', 'blocked'].includes(input.status) ? now : current.reviewedAt,
    resolution: ['cleared', 'blocked'].includes(input.status) ? input.reason.trim() : current.resolution,
    updatedAt: now,
  }).where(eq(complianceCases.id, input.caseId)).returning();
  await event(current.id, input.actorId, input.status === 'escalated' ? 'case_escalated' : 'case_transitioned', current.status, input.status, { reason: input.reason.trim(), riskLevel: input.riskLevel });
  return updated[0];
}

export async function listComplianceCases(userId?: string) {
  const db = getDb();
  return db.select().from(complianceCases).where(userId ? eq(complianceCases.userId, userId) : undefined).orderBy(desc(complianceCases.updatedAt));
}
