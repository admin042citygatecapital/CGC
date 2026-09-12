/**
 * Server-side store for the multi-account application system.
 *
 * Persistence: the existing Supabase `account_applications` table (extended by
 * migration 0018) plus `application_events` for the audit trail. Identity
 * linkage: one customer identity may hold many applications — a new
 * application never creates a duplicate user.
 */
import crypto from 'node:crypto';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { accountApplications, applicationEvents } from '../db/schema.js';
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

/** Save one step's validated data. Returns the updated row. */
export async function saveStep(input: {
  applicationId: string;
  stepId: string;
  data: Record<string, unknown>;
  actor: string;
}): Promise<{ ok: true; row: ApplicationRow } | { ok: false; error: string; errors?: Record<string, string> }> {
  const app = await getApplication(input.applicationId);
  if (!app) return { ok: false, error: 'Application not found.' };
  if (['APPROVED', 'REJECTED', 'ACTIVATION_PENDING'].includes(app.status)) {
    return { ok: false, error: 'This application has been decided and is no longer editable.' };
  }
  const type = app.accountType as AccountType;
  const step = APPLICATION_FLOWS[type]?.find(s => s.id === input.stepId);
  if (!step) return { ok: false, error: 'Unknown step for this application type.' };

  const errors = validateStep(step, input.data);
  if (Object.keys(errors).length > 0) return { ok: false, error: 'Validation failed.', errors };

  const steps = { ...app.steps, [input.stepId]: input.data };
  const nextStepIndex = APPLICATION_FLOWS[type].findIndex(s => s.id === input.stepId) + 1;
  const nextStep = APPLICATION_FLOWS[type][nextStepIndex]?.id ?? 'review';

  let status: ApplicationStatus | undefined;
  if (input.stepId === 'contact' && steps.verification?.verified !== true) {
    status = 'EMAIL_VERIFICATION_REQUIRED';
  }
  if (input.stepId === 'verification' && steps.verification?.verified === true) {
    status = 'EMAIL_VERIFIED';
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
    selectedPlan: typeof steps.contact === 'object' && steps[Object.keys(APPLICATION_FLOWS[type])[2]] &&
        typeof (steps[Object.keys(APPLICATION_FLOWS[type])[2]] as Record<string, unknown>).plan === 'string'
      ? String((steps[Object.keys(APPLICATION_FLOWS[type])[2]] as Record<string, unknown>).plan)
      : app.selectedPlan,
    updatedAt: new Date(),
  }).where(eq(accountApplications.id, input.applicationId)).returning();

  await recordEvent(input.applicationId, input.actor, null, `STEP_SAVED:${input.stepId}`, { nextStep });
  return { ok: true, row: row as ApplicationRow };
}

export async function markEmailVerified(applicationId: string, actor: string): Promise<void> {
  const app = await getApplication(applicationId);
  if (!app || app.emailVerified) return;
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
  const [row] = await getDb().update(accountApplications).set({
    status: 'REVIEW_REQUIRED', submittedAt: new Date(), updatedAt: new Date(),
  }).where(eq(accountApplications.id, input.applicationId)).returning();
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
    conditions.push(or(
      ilike(accountApplications.email, `%${filter.search}%`),
      ilike(accountApplications.firstName, `%${filter.search}%`),
      ilike(accountApplications.lastName, `%${filter.search}%`),
      ilike(accountApplications.reference, `%${filter.search}%`),
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
  return { ok: true, row: row as ApplicationRow };
}

export async function listApplicationEvents(applicationId: string) {
  if (!isDatabaseConfigured()) return [];
  return getDb().select().from(applicationEvents)
    .where(eq(applicationEvents.applicationId, applicationId))
    .orderBy(desc(applicationEvents.createdAt))
    .limit(200);
}