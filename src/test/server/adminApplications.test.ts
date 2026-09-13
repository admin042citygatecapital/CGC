/**
 * Admin applications search endpoints — City Gate Capital.
 *
 * Drives the real store and route handlers over a scripted database double so
 * the generated filters are asserted by behavior (parameter values and LIKE
 * matching) rather than by trusting raw SQL strings, following the module-mock
 * conventions of the other admin suites (see workflowConflict / adminKycLifecycle).
 */
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({
  configured: false,
  selectRows: [] as unknown[],
  updateRows: [] as unknown[],
  captured: {} as {
    /** WHERE predicate handed to the last `.where()` call. */
    where?: unknown;
    /** Page size handed to the last `.limit()` call. */
    limit?: number;
    /** Values handed to the last `.set()` call. */
    set?: Record<string, unknown>;
    /** Values handed to the last audit-trail `.values()` insert. */
    event?: Record<string, unknown>;
  },
}));

vi.mock('../../server/db/db.js', () => ({
  isDatabaseConfigured: () => mocks.configured,
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          mocks.captured.where = condition;
          const limit = (page: number) => {
            mocks.captured.limit = page;
            return Promise.resolve(mocks.selectRows);
          };
          return { limit, orderBy: () => ({ limit }) };
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        mocks.captured.set = values;
        return {
          where: () => ({ returning: () => Promise.resolve(mocks.updateRows) }),
        };
      },
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        mocks.captured.event = values;
        return Promise.resolve(undefined);
      },
    }),
  }),
}));

// decideApplication opens the linked KYC case lifecycle; keep it inert here.
vi.mock('../../server/lib/kycCaseStore.js', () => ({
  ensureCaseForApplication: vi.fn().mockResolvedValue(undefined),
  getCaseByApplication: vi.fn().mockResolvedValue(null),
  decideCase: vi.fn().mockResolvedValue(null),
}));

// The best-effort decision notice resolves a promise (the store chains .catch
// on it); mocking keeps the suite off the real transport and its
// provider-unconfigured path.
vi.mock('../../server/lib/emailService.js', () => ({
  sendApplicationDecisionEmail: vi.fn(() => Promise.resolve()),
}));

beforeEach(() => {
  vi.resetModules();
  mocks.configured = false;
  mocks.selectRows = [];
  mocks.updateRows = [];
  mocks.captured = {};
});

const adminSession = { adminId: 'admin-checker', email: 'admin@citygate.capital', role: 'COMPLIANCE_OFFICER' };

const applicationRow = {
  id: 'appl_cgc1', reference: 'CGC-1A2B3C4D', userId: 'usr_customer1',
  email: 'anna@example.test', firstName: 'Anna', lastName: 'Bell',
  accountType: 'INDIVIDUAL', selectedPlan: 'pro', status: 'REVIEW_REQUIRED',
  currentStep: 'review', completionPct: 90,
  steps: { contact: { email: 'anna@example.test' } },
  emailVerified: true, decision: null, decisionReason: null, informationRequest: null,
  createdAt: new Date('2026-09-01T10:00:00Z'), updatedAt: new Date('2026-09-02T10:00:00Z'),
};

function responseDouble() {
  const state: { status: number; body?: unknown } = { status: 200 };
  const res = {
    status(code: number) { state.status = code; return this; },
    json(body: unknown) { state.body = body; return this; },
  } as unknown as Response;
  return { res, state };
}

/** Interpret a SQL LIKE pattern (backslash escape) the way PostgreSQL would. */
function likeMatches(pattern: string, value: string): boolean {
  const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let source = '';
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '\\' && i + 1 < pattern.length) {
      source += literal(pattern[++i]);
      continue;
    }
    if (pattern[i] === '%') { source += '[\\s\\S]*'; continue; }
    if (pattern[i] === '_') { source += '[\\s\\S]'; continue; }
    source += literal(pattern[i]);
  }
  return new RegExp(`^[\\s\\S]*${source}[\\s\\S]*$`, 'i').test(value);
}

async function loadStore() {
  return import('../../server/lib/applicationsStore.js');
}

function renderedFilter(): ReturnType<PgDialect['sqlToQuery']> {
  const condition = mocks.captured.where as unknown as import('drizzle-orm').SQL;
  return new PgDialect().sqlToQuery(condition);
}

describe('applications store — admin search filters', () => {
  it('escapes LIKE wildcards so a search term matches only literal occurrences', async () => {
    mocks.configured = true;
    const { listApplicationsForAdmin } = await loadStore();
    await listApplicationsForAdmin({ search: 'a_b%c\\d' });
    const query = renderedFilter();
    // Every searched column receives the same escaped literal: % _ \ are data.
    const literal = '%a\\_b\\%c\\\\d%';
    expect(query.params.filter(param => param === literal)).toHaveLength(4);
    // The escaped operand, read the way PostgreSQL reads it, no longer treats
    // % and _ as wildcards.
    expect(likeMatches(literal, 'applicant a_b%c\\d stage')).toBe(true);
    expect(likeMatches(literal, 'a_b%c\\d')).toBe(true);
    expect(likeMatches(literal, 'applicant aXb at %c\\d stage')).toBe(false);
    expect(likeMatches(literal, 'applicant a_b at Xc\\d stage')).toBe(false);
    expect(likeMatches(literal, 'applicant a_b stage')).toBe(false);
  });

  it('searches across email, first name, last name, and reference', async () => {
    mocks.configured = true;
    const { listApplicationsForAdmin } = await loadStore();
    await listApplicationsForAdmin({ search: 'cgc' });
    const query = renderedFilter();
    for (const column of ['email', 'first_name', 'last_name', 'reference']) {
      expect(query.sql).toContain(`"account_applications"."${column}"`);
    }
  });

  it('filters by status and account type alongside the search term', async () => {
    mocks.configured = true;
    const { listApplicationsForAdmin } = await loadStore();
    await listApplicationsForAdmin({ type: 'INDIVIDUAL', status: 'REVIEW_REQUIRED', search: 'anna' });
    const query = renderedFilter();
    expect(query.params).toContain('INDIVIDUAL');
    expect(query.params).toContain('REVIEW_REQUIRED');
    expect(query.params.filter(param => param === '%anna%')).toHaveLength(4);
    expect(query.sql.toLowerCase()).toContain(' and ');
  });

  it('combines an unfiltered request into no WHERE predicate at all', async () => {
    mocks.configured = true;
    const { listApplicationsForAdmin } = await loadStore();
    await listApplicationsForAdmin({});
    expect(mocks.captured.where).toBeUndefined();
  });

  it('defaults the page size to 100 and clamps oversized requests at 200', async () => {
    mocks.configured = true;
    const { listApplicationsForAdmin } = await loadStore();
    await listApplicationsForAdmin({});
    expect(mocks.captured.limit).toBe(100);
    await listApplicationsForAdmin({ limit: 5000 });
    expect(mocks.captured.limit).toBe(200);
    await listApplicationsForAdmin({ limit: 5 });
    expect(mocks.captured.limit).toBe(5);
  });

  it('returns nothing while the database is offline', async () => {
    const { listApplicationsForAdmin } = await loadStore();
    await expect(listApplicationsForAdmin({ search: 'anna' })).resolves.toEqual([]);
  });
});

describe('GET /api/admin/applications', () => {
  it('applies the review-console query parameters and returns only the projected fields', async () => {
    mocks.configured = true;
    mocks.selectRows = [applicationRow];
    const handler = (await import('../../server/api/admin/applications/GET.js')).default;
    const { res, state } = responseDouble();
    // Unsupported parameters (date range, pagination) are silently ignored.
    await handler({
      query: {
        status: 'review_required', search: '  anna_  ',
        from: '2026-01-01', to: '2026-12-31', page: '3', limit: '500',
      },
    } as unknown as Request, res);

    const query = renderedFilter();
    expect(query.params).toContain('REVIEW_REQUIRED');
    expect(query.params.filter(param => param === '%anna\\_%')).toHaveLength(4);
    expect(query.params.filter(param => param === '2026-01-01' || param === '2026-12-31')).toHaveLength(0);
    // The route forwards no page size, so the store default applies.
    expect(mocks.captured.limit).toBe(100);

    expect(state.status).toBe(200);
    const body = state.body as { ok: boolean; applications: Array<Record<string, unknown>> };
    expect(body.ok).toBe(true);
    expect(Object.keys(body.applications[0]).sort()).toEqual([
      'accountType', 'completionPct', 'createdAt', 'currentStep', 'decision',
      'decisionReason', 'email', 'firstName', 'id', 'lastName', 'reference',
      'selectedPlan', 'status', 'updatedAt',
    ]);
    // Internal step data never reaches the admin list response.
    expect(body.applications[0]).not.toHaveProperty('steps');
  });

  it('answers 503 while the database is offline', async () => {
    const handler = (await import('../../server/api/admin/applications/GET.js')).default;
    const { res, state } = responseDouble();
    await handler({ query: { search: 'anna' } } as unknown as Request, res);
    expect(state.status).toBe(503);
    expect(state.body).toMatchObject({ error: 'Applications are unavailable while the database is offline.' });
  });
});

describe('POST /api/admin/applications/:id/decision', () => {
  const decidedRow = { ...applicationRow, status: 'APPROVED', decision: 'APPROVED', decisionReason: 'All evidence reviewed.' };

  it('records a validated decision and returns the decision shape', async () => {
    mocks.configured = true;
    mocks.selectRows = [applicationRow];
    mocks.updateRows = [decidedRow];
    const handler = (await import('../../server/api/admin/applications/[id]/decision/POST.js')).default;
    const { res, state } = responseDouble();
    await handler({
      params: { id: 'appl_cgc1' },
      body: { decision: 'APPROVED', reason: 'All evidence reviewed.' },
      adminSession,
    } as unknown as Request, res);

    expect(state).toMatchObject({
      status: 200,
      body: { ok: true, application: { id: 'appl_cgc1', status: 'APPROVED', decision: 'APPROVED' } },
    });
    expect(mocks.captured.set).toMatchObject({ status: 'APPROVED', decidedBy: 'admin-checker', decisionReason: 'All evidence reviewed.' });
    expect(mocks.captured.event).toMatchObject({
      applicationId: 'appl_cgc1', actor: 'admin-checker', actorRole: 'COMPLIANCE_OFFICER',
      event: 'DECISION:APPROVED', detail: { reason: 'All evidence reviewed.' },
    });
  });

  it('rejects unsupported decision values and a missing application id', async () => {
    mocks.configured = true;
    const handler = (await import('../../server/api/admin/applications/[id]/decision/POST.js')).default;
    const { res, state } = responseDouble();
    await handler({ params: { id: 'appl_cgc1' }, body: { decision: 'APPROVE', reason: 'All evidence reviewed.' }, adminSession } as unknown as Request, res);
    expect(state.status).toBe(400);
    expect((state.body as { error: string }).error).toContain('APPROVED');

    await handler({ params: {}, body: { decision: 'APPROVED', reason: 'All evidence reviewed.' }, adminSession } as unknown as Request, res);
    expect(state.status).toBe(400);
    expect(mocks.captured.set).toBeUndefined();
  });

  it('requires a reason of at least four characters', async () => {
    mocks.configured = true;
    const handler = (await import('../../server/api/admin/applications/[id]/decision/POST.js')).default;
    const { res, state } = responseDouble();
    await handler({ params: { id: 'appl_cgc1' }, body: { decision: 'APPROVED', reason: 'ok' }, adminSession } as unknown as Request, res);
    expect(state.status).toBe(400);
    expect(state.body).toMatchObject({ error: 'A reason of at least 4 characters is required for every decision.' });
    expect(mocks.captured.set).toBeUndefined();
  });

  it('maps an out-of-band store rejection to 409', async () => {
    mocks.configured = true;
    mocks.selectRows = [{ ...applicationRow, status: 'APPLICATION_STARTED' }];
    const handler = (await import('../../server/api/admin/applications/[id]/decision/POST.js')).default;
    const { res, state } = responseDouble();
    await handler({
      params: { id: 'appl_cgc1' },
      body: { decision: 'APPROVED', reason: 'All evidence reviewed.' },
      adminSession,
    } as unknown as Request, res);
    expect(state.status).toBe(409);
    expect((state.body as { error: string }).error).toContain('cannot be decided');
  });

  it('answers 503 while the database is offline', async () => {
    const handler = (await import('../../server/api/admin/applications/[id]/decision/POST.js')).default;
    const { res, state } = responseDouble();
    await handler({
      params: { id: 'appl_cgc1' },
      body: { decision: 'APPROVED', reason: 'All evidence reviewed.' },
      adminSession,
    } as unknown as Request, res);
    expect(state.status).toBe(503);
    expect(state.body).toMatchObject({ error: 'Applications are unavailable while the database is offline.' });
  });

  it('attributes the decision to the acting administrator with a safe fallback', async () => {
    mocks.configured = true;
    mocks.selectRows = [applicationRow];
    mocks.updateRows = [decidedRow];
    const handler = (await import('../../server/api/admin/applications/[id]/decision/POST.js')).default;

    await handler({
      params: { id: 'appl_cgc1' },
      body: { decision: 'APPROVED', reason: 'All evidence reviewed.' },
    } as unknown as Request, responseDouble().res);
    expect(mocks.captured.event).toMatchObject({ actor: 'unknown-admin', actorRole: '' });
    expect(mocks.captured.set).toMatchObject({ decidedBy: 'unknown-admin' });

    await handler({
      params: { id: 'appl_cgc1' },
      body: { decision: 'APPROVED', reason: 'All evidence reviewed.' },
      adminSession: { email: 'admin@citygate.capital' },
    } as unknown as Request, responseDouble().res);
    expect(mocks.captured.event).toMatchObject({ actor: 'admin@citygate.capital', actorRole: '' });
    expect(mocks.captured.set).toMatchObject({ decidedBy: 'admin@citygate.capital' });
  });
});
