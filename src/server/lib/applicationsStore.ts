/**
 * Server-side store for the multi-account application system.
 *
 * Persistence: the existing Supabase `account_applications` table (extended by
 * migration 0018) plus `application_events` for the audit trail. Identity
 * linkage: one customer identity may hold many applications — a new
 * application never creates a duplicate user.
 */
import crypto from 'node:crypto';
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { accountApplications, applicationEvents } from '../db/schema.js';
import { escapeLikePattern } from './inputValidator.js';
import { APPLICATION_FLOWS, validateStep, completionPct,
  type AccountType, type ApplicationStatus } from '../../shared/applicationFlow.js';

export interface ApplicationRow {
  id: string;
  reference: string | null;
  userId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  accountType: string;
  selectedPlan: string | null;
  status: string;
  currentStep: string;
  completionPct: number;
  steps: Record<string, Record<string, unknown>>;
  emailVerified: boolean;
  decision: string | null;
  decisionReason: string | null;
  informationRequest: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function ref(): string {
  return `CGC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function recordEvent(
  applicationId: string,
  actor: string,
  actorRole: string | null,
  event: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await getDb().insert(applicationEvents).values({
    id: crypto.randomUUID(), applicationId, actor, actorRole, event, detail,
  });
}

/** Create a new application. `userId` may be null until the identity step. */
export async function createApplication(input: {
  accountType: AccountType;
  plan?: string | null;
  userId?: string | null;
  email?: string;
  ip: string;
}): Promise<ApplicationRow> {
  const id = `appl_${crypto.randomBytes(12).toString('hex')}`;
  const now = new Date();
  const [row] = await getDb().insert(accountApplications).values({
    id,
    reference: ref(),
    userId: input.userId ?? null,
    email: input.email ?? '',
    accountType: input.accountType,
    selectedPlan: input.plan ?? null,
    status: 'APPLICATION_STARTED',
    currentStep: 'contact',
    completionPct: 0,
    steps: {},
    submittedAt: now,
    ip: input.ip ?? 'unknown',
    createdAt: now,
    updatedAt: now,
  }).returning();
  await recordEvent(id, input.userId ?? input.email ?? 'anonymous', null, 'APPLICATION_STARTED', { accountType: input.accountType });
  return row as ApplicationRow;
}

export async function getApplication(id: string): Promise<ApplicationRow | null> {
  if (!isDatabaseConfigured()) return null;
  const [row] = await getDb().select().from(accountApplications).where(eq(accountApplications.id, id)).limit(1);
  return (row as ApplicationRow) ?? null;
}

export async function listApplicationsForUser(userId: string): Promise<ApplicationRow[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await getDb().select().from(accountApplications)
    .where(eq(accountApplications.userId, userId))
    .orderBy(desc(accountApplications.updatedAt));
  return rows as ApplicationRow[];
}


/** Fields that must never be persisted in or returned from `steps`. */
const FORBIDDEN_STEP_KEYS = new Set(['password', 'confirmPassword', 'otp', 'cardNumber', 'cvv']);

/** Project step data onto its declared fields and drop credential fields. */
export function sanitizeStepData(
  stepId: string,
  data: Record<string, unknown>,
  type: AccountType,
): Record<string, unknown> {
  const step = APPLICATION_FLOWS[type]?.find(s => s.id === stepId);
  const known = new Set(step?.fields.map(f => f.name) ?? []);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (FORBIDDEN_STEP_KEYS.has(key) || (known.size > 0 && !known.has(key))) continue;
    out[key] = value;
  }
  return out;
}

/** Defense-in-depth for data persisted before the sanitizer existed. */
export function sanitizeSteps(steps: Record<string, Record<string, unknown>>): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [stepId, data] of Object.entries(steps)) {
    out[stepId] = Object.fromEntries(
      Object.entries(data).filter(([k]) => !FORBIDDEN_STEP_KEYS.has(k)),
    );
  }
  return out;
}

/** Save one step's validated data. Returns the updated row. */
export async function saveStep(input: {
  applicationId: string;
  stepId: string;
  data: Record<string, unknown>;
  actor: string;
}): Promise<{ ok: true; row: ApplicationRow } | { ok: false; error: string; errors?: Record<string, string> }> {
  const app = await getApplication(input.applicationId);
  if (!app) return { ok: false, error: 'Application not found.' };
  if (['REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'ACTIVATION_PENDING'].includes(app.status)) {
    return { ok: false, error: 'This application has been decided and is no longer editable.' };
  }
  const type = app.accountType as AccountType;
  const step = APPLICATION_FLOWS[type]?.find(s => s.id === input.stepId);
  if (!step) return { ok: false, error: 'Unknown step for this application type.' };

  const errors = validateStep(step, input.data);
  if (Object.keys(errors).length > 0) return { ok: false, error: 'Validation failed.', errors };

  const cleaned = sanitizeStepData(input.stepId, input.data, type);
  const steps = { ...app.steps, [input.stepId]: cleaned };
  const nextStepIndex = APPLICATION_FLOWS[type].findIndex(s => s.id === input.stepId) + 1;
  const nextStep = APPLICATION_FLOWS[type][nextStepIndex]?.id ?? 'review';

  // Status derives from the email_verified column — never from step data —
  // so re-saving a step can never regress a verified application.
  let status: ApplicationStatus | undefined;
  if (input.stepId === 'contact' && app.userId) {
    status = app.emailVerified ? 'EMAIL_VERIFIED' : 'EMAIL_VERIFICATION_REQUIRED';
  }

  const [row] = await getDb().update(accountApplications).set({
    steps,
    currentStep: nextStep,
    completionPct: completionPct(type, steps),
    ...(status ? { status } : {}),
    // Promote identity fields from the personal/contact steps for admin search.
    firstName: typeof steps.personal?.firstName === 'string' ? String(steps.personal.firstName) : app.firstName,
    lastName: typeof steps.personal?.lastName === 'string' ? String(steps.personal.lastName) : app.lastName,
    email: typeof steps.contact?.email === 'string' ? String(steps.contact.email).toLowerCase() : app.email,
    selectedPlan: (APPLICATION_FLOWS[type]
      .map(s => (steps[s.id] ?? {}) as Record<string, unknown>)
      .map(stepData => stepData.plan)
      .find(p => typeof p === 'string' && (p as string).length > 0) as string | undefined) ?? app.selectedPlan,
    updatedAt: new Date(),
  }).where(eq(accountApplications.id, input.applicationId)).returning();

  await recordEvent(input.applicationId, input.actor, null, `STEP_SAVED:${input.stepId}`, { nextStep });
  return { ok: true, row: row as ApplicationRow };
}

export async function markEmailVerified(applicationId: string, actor: string): Promise<void> {
  const app = await getApplication(applicationId);
  if (!app) return;
  if (app.emailVerified && app.status === 'EMAIL_VERIFIED') return;
  await getDb().update(accountApplications)
    .set({ emailVerified: true, status: 'EMAIL_VERIFIED', updatedAt: new Date() })
    .where(eq(accountApplications.id, applicationId));
  await recordEvent(applicationId, actor, null, 'EMAIL_VERIFIED', {});
}

export async function linkUser(applicationId: string, userId: string, email: string): Promise<void> {
  await getDb().update(accountApplications)
    .set({ userId, email, updatedAt: new Date() })
    .where(eq(accountApplications.id, applicationId));
  await recordEvent(applicationId, email, null, 'IDENTITY_LINKED', { userId });
}

export async function submitApplication(input: {
  applicationId: string;
  actor: string;
}): Promise<{ ok: true; row: ApplicationRow } | { ok: false; error: string }> {
  const app = await getApplication(input.applicationId);
  if (!app) return { ok: false, error: 'Application not found.' };
  if (app.status !== 'EMAIL_VERIFIED' && app.status !== 'NEEDS_INFORMATION') {
    return { ok: false, error: 'Complete all steps and verify your email before submitting.' };
  }
  const type = app.accountType as AccountType;
  for (const step of APPLICATION_FLOWS[type]) {
    if (step.id === 'verification' || step.id === 'review') continue;
    const errors = validateStep(step, app.steps[step.id] ?? {});
    if (Object.keys(errors).length > 0) {
      return { ok: false, error: `Step "${step.title}" is incomplete.` };
    }
  }
  // Conditional transition: only submit from a valid status (prevents the
  // double-submit race and mid-review data flips).
  const [row] = await getDb().update(accountApplications).set({
    status: 'REVIEW_REQUIRED', submittedAt: new Date(), updatedAt: new Date(),
  }).where(and(
    eq(accountApplications.id, input.applicationId),
    inArray(accountApplications.status, ['EMAIL_VERIFIED', 'NEEDS_INFORMATION']),
  )).returning();
  if (!row) {
    const current = await getApplication(input.applicationId);
    return { ok: false, error: current && ['REVIEW_REQUIRED', 'APPROVED', 'ACTIVATION_PENDING'].includes(current.status)
      ? 'This application is already submitted.' : 'Complete all steps and verify your email before submitting.' };
  }
  await recordEvent(input.applicationId, input.actor, null, 'APPLICATION_SUBMITTED', {});
  // Open the per-application KYC case (SUBMITTED → review lifecycle).
  const { ensureCaseForApplication } = await import('./kycCaseStore.js');
  await ensureCaseForApplication({
    applicationId: input.applicationId, userId: app.userId,
    accountType: app.accountType, actor: input.actor,
  });
  return { ok: true, row: row as ApplicationRow };
}

// ── Admin surface ────────────────────────────────────────────────────────────

export async function listApplicationsForAdmin(filter: {
  type?: string; status?: string; search?: string; limit?: number;
}): Promise<ApplicationRow[]> {
  if (!isDatabaseConfigured()) return [];
  const conditions = [];
  if (filter.type) conditions.push(eq(accountApplications.accountType, filter.type));
  if (filter.status) conditions.push(eq(accountApplications.status, filter.status));
  if (filter.search) {
    const like = escapeLikePattern(filter.search);
    conditions.push(or(
      ilike(accountApplications.email, `%${like}%`),
      ilike(accountApplications.firstName, `%${like}%`),
      ilike(accountApplications.lastName, `%${like}%`),
      ilike(accountApplications.reference, `%${like}%`),
    ));
  }
  const rows = await getDb().select().from(accountApplications)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(accountApplications.updatedAt))
    .limit(Math.min(filter.limit ?? 100, 200));
  return rows as ApplicationRow[];
}

export type AdminDecision = 'APPROVED' | 'REJECTED' | 'NEEDS_INFORMATION' | 'REVIEW_REQUIRED' | 'ACTIVATION_PENDING';

export async function decideApplication(input: {
  applicationId: string;
  decision: AdminDecision;
  reason: string;
  informationRequest?: string;
  adminId: string;
  adminRole: string;
}): Promise<{ ok: true; row: ApplicationRow } | { ok: false; error: string }> {
  const app = await getApplication(input.applicationId);
  if (!app) return { ok: false, error: 'Application not found.' };
  if (!['REVIEW_REQUIRED', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED'].includes(app.status)) {
    return { ok: false, error: `Application in status ${app.status} cannot be decided.` };
  }
  // A byte-identical re-decision (same status and rationale) must not bump
  // the record or re-send the decision email; the same status with new
  // content is a legitimate re-decision (e.g. an updated information
  // request) and proceeds through the normal path.
  if (app.status === input.decision) {
    const incomingInformationRequest = input.decision === 'NEEDS_INFORMATION'
      ? (input.informationRequest ?? input.reason)
      : undefined;
    const storedInformationRequest = input.decision === 'NEEDS_INFORMATION'
      ? app.informationRequest
      : undefined;
    if ((app.decisionReason ?? '') === input.reason &&
        (storedInformationRequest ?? '') === (incomingInformationRequest ?? '')) {
      return { ok: false, error: `Application already carries status ${input.decision} with the same rationale; nothing to decide.` };
    }
  }
  const [row] = await getDb().update(accountApplications).set({
    status: input.decision,
    decisionReason: input.reason,
    informationRequest: input.decision === 'NEEDS_INFORMATION' ? (input.informationRequest ?? input.reason) : app.informationRequest,
    decidedBy: input.adminId,
    decidedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(accountApplications.id, input.applicationId)).returning();
  await recordEvent(input.applicationId, input.adminId, input.adminRole, `DECISION:${input.decision}`, {
    reason: input.reason,
  });
  // Keep the linked KYC case lifecycle in step with the application decision.
  const { getCaseByApplication, decideCase } = await import('./kycCaseStore.js');
  const kycCase = await getCaseByApplication(input.applicationId);
  if (kycCase && kycCase.status !== input.decision && ['APPROVED', 'REJECTED', 'NEEDS_INFORMATION', 'UNDER_REVIEW', 'EXPIRED'].includes(input.decision)) {
    await decideCase({
      caseId: kycCase.id, decision: input.decision as 'APPROVED' | 'REJECTED' | 'NEEDS_INFORMATION' | 'UNDER_REVIEW' | 'EXPIRED',
      reason: input.reason, reviewerId: input.adminId, reviewerRole: input.adminRole,
    });
  }
  // Decision notice — best-effort, sent after the store writes and never
  // blocking the decision response (mirrors the KYC review delivery pattern).
  const decided = row as ApplicationRow | undefined;
  if (decided) {
    const { sendApplicationDecisionEmail } = await import('./emailService.js');
    sendApplicationDecisionEmail(
      decided.email,
      [decided.firstName, decided.lastName].filter(Boolean).join(' ') || 'Applicant',
      {
        decision: input.decision,
        reference: decided.reference ?? input.applicationId,
        reason: input.reason,
        informationRequest: input.decision === 'NEEDS_INFORMATION' ? (input.informationRequest ?? input.reason) : undefined,
      },
    ).catch(error => console.warn(JSON.stringify({
      event: 'application.decision.email_failed', applicationId: input.applicationId, decision: input.decision, error: String(error),
    })));
  }
  return { ok: true, row: decided as ApplicationRow };
}

export async function listApplicationEvents(applicationId: string) {
  if (!isDatabaseConfigured()) return [];
  return getDb().select().from(applicationEvents)
    .where(eq(applicationEvents.applicationId, applicationId))
    .orderBy(desc(applicationEvents.createdAt))
    .limit(200);
}