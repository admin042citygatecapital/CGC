import crypto from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { assuranceExerciseEvents, assuranceExercises, type AssuranceExerciseRow } from '../db/schema.js';
import { appendAuditEntry } from './auditLog.js';
import type { AdminRole } from './sessionStore.js';

export type AssuranceKind = 'penetration_test'|'disaster_recovery'|'compliance_acceptance';
export type AssuranceOutcome = 'not_run'|'passed'|'passed_with_findings'|'failed';
export interface AssuranceActor { id: string; email: string; role: AdminRole; ip?: string }
export interface AssuranceInput {
  id?: string; kind: AssuranceKind; title: string; scope: string; owner: string; provider?: string|null;
  outcome?: AssuranceOutcome; evidenceUrl?: string|null; evidenceSha256?: string|null; startedAt?: string|null;
  completedAt?: string|null; expiresAt?: string|null; criticalFindings?: number; highFindings?: number; openFindings?: number; notes?: string|null;
}

export class AssuranceExerciseError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400) { super(message); }
}

const kinds = new Set<AssuranceKind>(['penetration_test','disaster_recovery','compliance_acceptance']);
const outcomes = new Set<AssuranceOutcome>(['not_run','passed','passed_with_findings','failed']);

function text(value: unknown, name: string, min: number, max: number): string {
  const result = String(value ?? '').trim();
  if (result.length < min || result.length > max) throw new AssuranceExerciseError(`${name} must be ${min}-${max} characters.`, 'VALIDATION_ERROR');
  return result;
}
function optionalText(value: unknown, name: string, max: number): string|null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return text(value, name, 2, max);
}
function date(value: unknown, name: string): Date|null {
  if (!value) return null; const result = new Date(String(value));
  if (Number.isNaN(result.getTime())) throw new AssuranceExerciseError(`${name} must be a valid date.`, 'VALIDATION_ERROR');
  return result;
}
function count(value: unknown, name: string): number {
  const result = Number(value ?? 0); if (!Number.isInteger(result) || result < 0 || result > 100000) throw new AssuranceExerciseError(`${name} must be a non-negative integer.`, 'VALIDATION_ERROR');
  return result;
}

export function requiredRoleForAssurance(kind: AssuranceKind): AdminRole {
  return kind === 'compliance_acceptance' ? 'COMPLIANCE_ADMIN' : 'SECURITY_ADMIN';
}
export function assertAssuranceRole(kind: AssuranceKind, role: AdminRole): void {
  if (role !== 'SUPER_ADMIN' && role !== requiredRoleForAssurance(kind)) throw new AssuranceExerciseError('Your role does not own this assurance exercise.', 'ROLE_FORBIDDEN', 403);
}
export function validateAssuranceInput(input: AssuranceInput) {
  if (!kinds.has(input.kind)) throw new AssuranceExerciseError('Unknown assurance kind.', 'VALIDATION_ERROR');
  const outcome = input.outcome ?? 'not_run'; if (!outcomes.has(outcome)) throw new AssuranceExerciseError('Unknown assurance outcome.', 'VALIDATION_ERROR');
  const evidenceUrl = optionalText(input.evidenceUrl, 'evidenceUrl', 500);
  if (evidenceUrl) { let parsed: URL; try { parsed = new URL(evidenceUrl); } catch { throw new AssuranceExerciseError('evidenceUrl is invalid.', 'VALIDATION_ERROR'); } if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new AssuranceExerciseError('Evidence URLs must use HTTPS and contain no credentials.', 'VALIDATION_ERROR'); }
  const evidenceSha256 = optionalText(input.evidenceSha256, 'evidenceSha256', 64)?.toLowerCase() ?? null;
  if (evidenceSha256 && !/^[a-f0-9]{64}$/.test(evidenceSha256)) throw new AssuranceExerciseError('evidenceSha256 must be a SHA-256 digest.', 'VALIDATION_ERROR');
  const startedAt = date(input.startedAt, 'startedAt'), completedAt = date(input.completedAt, 'completedAt'), expiresAt = date(input.expiresAt, 'expiresAt');
  if (startedAt && completedAt && completedAt < startedAt) throw new AssuranceExerciseError('completedAt cannot be before startedAt.', 'VALIDATION_ERROR');
  if (completedAt && expiresAt && expiresAt <= completedAt) throw new AssuranceExerciseError('expiresAt must be after completedAt.', 'VALIDATION_ERROR');
  return { kind: input.kind, title: text(input.title,'title',3,180), scope: text(input.scope,'scope',10,4000), owner: text(input.owner,'owner',2,160), provider: optionalText(input.provider,'provider',180), outcome, evidenceUrl, evidenceSha256, startedAt, completedAt, expiresAt, criticalFindings: count(input.criticalFindings,'criticalFindings'), highFindings: count(input.highFindings,'highFindings'), openFindings: count(input.openFindings,'openFindings'), notes: optionalText(input.notes,'notes',4000) };
}
export function assertAssuranceSubmittable(row: Pick<AssuranceExerciseRow,'outcome'|'evidenceUrl'|'evidenceSha256'|'completedAt'|'criticalFindings'|'highFindings'|'openFindings'>): void {
  if (!row.completedAt || !row.evidenceUrl || !row.evidenceSha256 || row.outcome === 'not_run') throw new AssuranceExerciseError('Completed date, evidence URL, SHA-256 digest and outcome are required.', 'INCOMPLETE_EXERCISE', 409);
  if (row.outcome === 'passed' && (row.criticalFindings > 0 || row.highFindings > 0 || row.openFindings > 0)) throw new AssuranceExerciseError('An exercise with open findings cannot be marked passed.', 'OPEN_FINDINGS', 409);
}
export function assertAssuranceAcceptable(row: Pick<AssuranceExerciseRow,'outcome'|'criticalFindings'|'highFindings'|'openFindings'>): void {
  if (row.outcome !== 'passed' || row.criticalFindings || row.highFindings || row.openFindings) throw new AssuranceExerciseError('Acceptance requires a passed outcome with zero open findings.', 'REMEDIATION_REQUIRED', 409);
}

function requireDb() { if (!isDatabaseConfigured()) throw new AssuranceExerciseError('Assurance exercises require PostgreSQL.', 'DATABASE_REQUIRED', 503); }
async function event(row: AssuranceExerciseRow, action: string, actor: AssuranceActor, fromStatus?: string, details: Record<string,unknown> = {}) {
  await getDb().insert(assuranceExerciseEvents).values({ id:`aee_${crypto.randomUUID()}`, exerciseId:row.id, action, actorId:actor.id, actorRole:actor.role, fromStatus, toStatus:row.status, details });
  await appendAuditEntry({ adminId:actor.id, adminEmail:actor.email, action:`assurance_${action}`, target:'assurance-exercise', targetId:row.id, details:{kind:row.kind,...details}, ip:actor.ip });
}
export async function listAssuranceExercises() { requireDb(); const [exercises,events]=await Promise.all([getDb().select().from(assuranceExercises).orderBy(asc(assuranceExercises.createdAt)),getDb().select().from(assuranceExerciseEvents).orderBy(asc(assuranceExerciseEvents.createdAt))]); return { exercises, events, financialOperationsLocked:true as const }; }
export async function saveAssuranceExercise(input: AssuranceInput, actor: AssuranceActor) {
  requireDb(); const value=validateAssuranceInput(input); assertAssuranceRole(value.kind,actor.role); const now=new Date();
  if (input.id) { const found=(await getDb().select().from(assuranceExercises).where(eq(assuranceExercises.id,input.id)).limit(1))[0]; if(!found) throw new AssuranceExerciseError('Exercise not found.','NOT_FOUND',404); assertAssuranceRole(found.kind,actor.role); if(!['planned','in_progress','rejected'].includes(found.status)) throw new AssuranceExerciseError('Submitted or accepted exercises cannot be edited.','INVALID_STATE',409); const row=(await getDb().update(assuranceExercises).set({...value,status:value.startedAt?'in_progress':'planned',lastEditedBy:actor.id,submittedBy:null,submittedAt:null,reviewedBy:null,reviewedAt:null,reviewNote:null,updatedAt:now}).where(eq(assuranceExercises.id,input.id)).returning())[0]; await event(row,'edited',actor,found.status); return row; }
  const row=(await getDb().insert(assuranceExercises).values({id:`ase_${crypto.randomUUID()}`,...value,status:value.startedAt?'in_progress':'planned',createdBy:actor.id,lastEditedBy:actor.id,createdAt:now,updatedAt:now}).returning())[0]; await event(row,'created',actor); return row;
}
export async function submitAssuranceExercise(id:string,actor:AssuranceActor){ requireDb(); const row=(await getDb().select().from(assuranceExercises).where(eq(assuranceExercises.id,id)).limit(1))[0]; if(!row) throw new AssuranceExerciseError('Exercise not found.','NOT_FOUND',404); assertAssuranceRole(row.kind,actor.role); if(!['planned','in_progress','rejected'].includes(row.status)) throw new AssuranceExerciseError('Exercise cannot be submitted from its current state.','INVALID_STATE',409); assertAssuranceSubmittable(row); const updated=(await getDb().update(assuranceExercises).set({status:'submitted',submittedBy:actor.id,submittedAt:new Date(),reviewedBy:null,reviewedAt:null,reviewNote:null,updatedAt:new Date()}).where(eq(assuranceExercises.id,id)).returning())[0]; await event(updated,'submitted',actor,row.status); return updated; }
export async function reviewAssuranceExercise(id:string,decision:'accepted'|'rejected',note:string,actor:AssuranceActor){ requireDb(); const row=(await getDb().select().from(assuranceExercises).where(eq(assuranceExercises.id,id)).limit(1))[0]; if(!row) throw new AssuranceExerciseError('Exercise not found.','NOT_FOUND',404); assertAssuranceRole(row.kind,actor.role); if(row.status!=='submitted') throw new AssuranceExerciseError('Only submitted exercises may be reviewed.','INVALID_STATE',409); if(row.submittedBy===actor.id||row.lastEditedBy===actor.id) throw new AssuranceExerciseError('Maker-checker prevents self-review.','MAKER_CHECKER_VIOLATION',409); if(decision==='accepted') assertAssuranceAcceptable(row); const reviewNote=text(note,'reviewNote',10,1000); const updated=(await getDb().update(assuranceExercises).set({status:decision,reviewedBy:actor.id,reviewedAt:new Date(),reviewNote,updatedAt:new Date()}).where(eq(assuranceExercises.id,id)).returning())[0]; await event(updated,'reviewed',actor,'submitted',{decision,reviewNote}); return updated; }
