/**
 * KYC case review surface — City Gate Capital.
 *
 * Covers the hardening added for the per-account-type KYC panel:
 *  - the RLS migration for the application/KYC tables,
 *  - the admin case detail / notes / reviewer-assignment routes,
 *  - short-lived signed-URL document issuance with audit logging,
 *  - and the shared flow-completeness contracts for all five account types.
 * The real stores run against a scripted database double that dispatches on
 * table identity, following the module-mock conventions of the admin suites.
 */
import { readFileSync } from 'node:fs';
import type { Request, Response } from 'express';
import { APPLICATION_FLOWS } from '../../shared/applicationFlow.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configured: false,
  caseRows: [] as Array<Record<string, unknown>>,
  applicationRows: [] as Array<Record<string, unknown>>,
  documentRows: [] as Array<Record<string, unknown>>,
  eventRows: [] as unknown[],
  updateRows: [] as Array<Record<string, unknown>>,
  captured: {} as {
    set?: Record<string, unknown>;
    event?: Record<string, unknown>;
    eventInserts?: Array<Record<string, unknown>>;
  },
  auditEntries: [] as Array<Record<string, unknown>>,
  signed: { ok: true, url: 'https://stub.supabase.co/storage/v1/object/sign/cgc-kyc-private/cases/abc/doc.pdf?token=t', error: '' as string },
}));

vi.mock('../../server/db/db.js', async () => {
  // Dispatch on the table's SQL name instead of module identity:
  // vi.resetModules() re-imports a fresh schema module for the store under
  // test, but the mocked db module keeps its factory-captured schema
  // instance, so identity comparisons would always miss. getTableName reads
  // pure table data and is stable across module generations.
  const { getTableName } = await import('drizzle-orm');
  type Table = Parameters<typeof getTableName>[0];
  const rowsFor = (table: Table): unknown[] => {
    switch (getTableName(table)) {
      case 'kyc_cases': return mocks.caseRows;
      case 'account_applications': return mocks.applicationRows;
      case 'kyc_case_documents': return mocks.documentRows;
      case 'kyc_case_events': return mocks.eventRows;
      default: return [];
    }
  };
  const chain = (table: Table) => {
    const promise = Promise.resolve(rowsFor(table));
    return {
      limit: (_n: number) => promise,
      orderBy: () => ({ limit: (_n: number) => promise }),
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise),
    };
  };
  return {
    isDatabaseConfigured: () => mocks.configured,
    getDb: () => ({
      select: () => ({
        from: (table: Table) => ({
          where: (_condition: unknown) => chain(table),
        }),
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          mocks.captured.set = values;
          return { where: () => ({ returning: () => Promise.resolve(mocks.updateRows) }) };
        },
      }),
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          mocks.captured.event = values;
          mocks.captured.eventInserts = [...(mocks.captured.eventInserts ?? []), values];
          return Promise.resolve(undefined);
        },
      }),
    }),
  };
});

vi.mock('../../server/lib/auditLog.js', () => ({
  appendAuditEntry: (entry: Record<string, unknown>) => {
    mocks.auditEntries.push(entry);
    return Promise.resolve();
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      getBucket: () => Promise.resolve({ data: { public: false }, error: null }),
      from: () => ({
        createSignedUrl: (_key: string, _expiresIn: number) => (
          mocks.signed.ok
            ? Promise.resolve({ data: { signedUrl: mocks.signed.url }, error: null })
            : Promise.resolve({ data: null, error: { message: mocks.signed.error || 'storage error' } })
        ),
      }),
    },
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  mocks.configured = false;
  mocks.caseRows = [];
  mocks.applicationRows = [];
  mocks.documentRows = [];
  mocks.eventRows = [];
  mocks.updateRows = [];
  mocks.captured = {};
  mocks.auditEntries = [];
  mocks.signed = { ok: true, url: 'https://stub.supabase.co/storage/v1/object/sign/cgc-kyc-private/cases/abc/doc.pdf?token=t', error: '' };
});

const adminSession = { adminId: 'admin-reviewer', email: 'compliance@citygate.capital', role: 'COMPLIANCE_ADMIN' };

const caseRow = {
  id: 'b7e2a1c0-0000-4000-8000-000000000001', applicationId: 'appl_case1', userId: 'usr_1',
  accountType: 'PERSONAL', status: 'SUBMITTED', riskLevel: 'unrated', reviewerId: null,
  providerName: null, providerStatus: null, providerRef: null,
  submittedAt: new Date('2026-09-10T10:00:00Z'), reviewedAt: null, reviewReason: null,
  createdAt: new Date('2026-09-10T10:00:00Z'), updatedAt: new Date('2026-09-10T10:00:00Z'),
};

const applicationRow = {
  id: 'appl_case1', reference: 'CGC-1A2B3C4D', userId: 'usr_1', email: 'anna@example.test',
  firstName: 'Anna', lastName: 'Bell', accountType: 'PERSONAL', selectedPlan: 'STANDARD',
  status: 'REVIEW_REQUIRED', completionPct: 100, informationRequest: null, decisionReason: null,
};

const documentRow = {
  id: 'c0ffee00-0000-4000-8000-000000000004', caseId: caseRow.id, documentType: 'PASSPORT',
  issuingCountry: 'United Kingdom', storagePath: 'cases/abcdef0123456789abcdef0123/c0ffee00-0000-4000-8000-000000000004.pdf',
  mimeType: 'application/pdf', byteSize: 1234, originalName: 'passport.pdf',
  uploadedBy: 'anna@example.test', createdAt: new Date('2026-09-10T10:05:00Z'),
};

function responseDouble() {
  const state: { status: number; body?: unknown } = { status: 0 };
  const res = {
    status(code: number) { state.status = code; return res; },
    json(payload: unknown) { state.body = payload; return res; },
  } as unknown as Response;
  return { res, state };
}

describe('RLS migration for application and KYC tables', () => {
  const migration = () => readFileSync('src/server/db/migrations/0102_kyc_application_rls.sql', 'utf8');

  it('enables row level security on every application/KYC table', () => {
    const sql = migration();
    for (const table of ['account_applications', 'application_events', 'kyc_cases', 'kyc_case_events', 'kyc_case_documents']) {
      expect(sql).toContain(`ALTER TABLE ${table}`);
      expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    }
  });

  it('revokes the public Data API roles from the sensitive tables', () => {
    const sql = migration();
    expect(sql).toMatch(/REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC/);
    expect(sql).toMatch(/FROM anon/);
    expect(sql).toMatch(/FROM authenticated/);
    expect(sql).toContain("pg_roles WHERE rolname = 'anon'");
    expect(sql).toContain("pg_roles WHERE rolname = 'authenticated'");
  });
});

describe('GET /api/admin/kyc-cases/:id — case detail', () => {
  it('answers 503 while the database is offline', async () => {
    const handler = (await import('../../server/api/admin/kyc-cases/[id]/GET.js')).default;
    const { res, state } = responseDouble();
    await handler({ params: { id: caseRow.id } } as unknown as Request, res);
    expect(state.status).toBe(503);
  });

  it('answers 404 for an unknown case', async () => {
    mocks.configured = true;
    const handler = (await import('../../server/api/admin/kyc-cases/[id]/GET.js')).default;
    const { res, state } = responseDouble();
    await handler({ params: { id: 'missing' } } as unknown as Request, res);
    expect(state.status).toBe(404);
  });

  it('returns the case, application summary and metadata-only documents', async () => {
    mocks.configured = true;
    mocks.caseRows = [caseRow];
    mocks.applicationRows = [applicationRow];
    mocks.documentRows = [documentRow];
    mocks.eventRows = [{ id: 'ev1', event: 'KYC_SUBMITTED', actor: 'anna@example.test', actorRole: null, createdAt: new Date('2026-09-10T10:00:00Z') }];
    const handler = (await import('../../server/api/admin/kyc-cases/[id]/GET.js')).default;
    const { res, state } = responseDouble();
    await handler({ params: { id: caseRow.id } } as unknown as Request, res);
    expect(state.status).toBe(200);
    const body = state.body as { kycCase: { status: string; accountType: string }; application: { reference: string }; documents: Array<Record<string, unknown>>; events: unknown[] };
    expect(body.kycCase.status).toBe('SUBMITTED');
    expect(body.application.reference).toBe('CGC-1A2B3C4D');
    expect(body.documents).toHaveLength(1);
    // The private storage path must never leave the server.
    expect(JSON.stringify(body.documents)).not.toContain('storagePath');
    expect(JSON.stringify(body.documents)).not.toContain('storage_path');
    expect(JSON.stringify(body.documents)).not.toContain('cases/');
    expect(body.events).toHaveLength(1);
  });
});

describe('POST /api/admin/kyc-cases/:id/notes — internal notes', () => {
  it('rejects notes shorter than two characters', async () => {
    mocks.configured = true;
    const handler = (await import('../../server/api/admin/kyc-cases/[id]/notes/POST.js')).default;
    const { res, state } = responseDouble();
    await handler({ params: { id: caseRow.id }, body: { note: 'x' } } as unknown as Request, res);
    expect(state.status).toBe(400);
    expect(mocks.captured.event).toBeUndefined();
  });

  it('answers 404 for an unknown case', async () => {
    mocks.configured = true;
    const handler = (await import('../../server/api/admin/kyc-cases/[id]/notes/POST.js')).default;
    const { res, state } = responseDouble();
    await handler({ params: { id: 'missing' }, body: { note: 'A legitimate note.' } } as unknown as Request, res);
    expect(state.status).toBe(404);
  });

  it('records the note as a case event attributed to the acting administrator', async () => {
    mocks.configured = true;
    mocks.caseRows = [caseRow];
    const handler = (await import('../../server/api/admin/kyc-cases/[id]/notes/POST.js')).default;
    const { res, state } = responseDouble();
    await handler({
      params: { id: caseRow.id }, body: { note: 'Passport matches the applicant.' }, adminSession,
    } as unknown as Request, res);
    expect(state.status).toBe(201);
    expect(mocks.captured.event).toMatchObject({ event: 'KYC_NOTE_ADDED', actor: 'admin-reviewer', actorRole: 'COMPLIANCE_ADMIN' });
  });
});

describe('POST /api/admin/kyc-cases/:id/assign — reviewer assignment', () => {
  it('rejects an empty reviewer', async () => {
    mocks.configured = true;
    const handler = (await import('../../server/api/admin/kyc-cases/[id]/assign/POST.js')).default;
    const { res, state } = responseDouble();
    await handler({ params: { id: caseRow.id }, body: { reviewerId: '' } } as unknown as Request, res);
    expect(state.status).toBe(400);
  });

  it('answers 404 for an unknown case', async () => {
    mocks.configured = true;
    const handler = (await import('../../server/api/admin/kyc-cases/[id]/assign/POST.js')).default;
    const { res, state } = responseDouble();
    await handler({ params: { id: 'missing' }, body: { reviewerId: 'admin-2' } } as unknown as Request, res);
    expect(state.status).toBe(404);
  });

  it('updates the reviewer and records a REVIEWER_ASSIGNED event', async () => {
    mocks.configured = true;
    mocks.updateRows = [{ ...caseRow, reviewerId: 'admin-2' }];
    const handler = (await import('../../server/api/admin/kyc-cases/[id]/assign/POST.js')).default;
    const { res, state } = responseDouble();
    await handler({
      params: { id: caseRow.id }, body: { reviewerId: 'admin-2' }, adminSession,
    } as unknown as Request, res);
    expect(state.status).toBe(200);
    expect(mocks.captured.set).toMatchObject({ reviewerId: 'admin-2' });
    expect(mocks.captured.event).toMatchObject({ event: 'REVIEWER_ASSIGNED', actor: 'admin-reviewer' });
  });
});

describe('GET /api/admin/kyc-cases/:id/documents/:documentId — signed URLs', () => {
  it('rejects malformed document ids before touching storage', async () => {
    mocks.configured = true;
    const handler = (await import('../../server/api/admin/kyc-cases/[id]/documents/[documentId]/GET.js')).default;
    const { res, state } = responseDouble();
    await handler({ params: { id: caseRow.id, documentId: '../../etc/passwd' } } as unknown as Request, res);
    expect(state.status).toBe(400);
    expect(mocks.auditEntries).toHaveLength(0);
  });

  it('answers 404 when the document does not belong to the case', async () => {
    mocks.configured = true;
    const handler = (await import('../../server/api/admin/kyc-cases/[id]/documents/[documentId]/GET.js')).default;
    const { res, state } = responseDouble();
    await handler({
      params: { id: caseRow.id, documentId: documentRow.id }, adminSession,
    } as unknown as Request, res);
    expect(state.status).toBe(404);
  });

  it('answers 503 without leaking anything when storage is not configured', async () => {
    mocks.configured = true;
    mocks.documentRows = [documentRow];
    // No Supabase env vars are stubbed in this test.
    const handler = (await import('../../server/api/admin/kyc-cases/[id]/documents/[documentId]/GET.js')).default;
    const { res, state } = responseDouble();
    await handler({
      params: { id: caseRow.id, documentId: documentRow.id }, adminSession,
    } as unknown as Request, res);
    expect(state.status).toBe(503);
    expect(JSON.stringify(state.body)).not.toContain('cases/');
    expect(mocks.auditEntries).toHaveLength(0);
  });

  it('issues a short-lived signed URL, audits the view and never exposes the storage path', async () => {
    mocks.configured = true;
    mocks.documentRows = [documentRow];
    vi.stubEnv('SUPABASE_URL', 'https://stub.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'stub-service-key');
    const handler = (await import('../../server/api/admin/kyc-cases/[id]/documents/[documentId]/GET.js')).default;
    const { res, state } = responseDouble();
    await handler({
      params: { id: caseRow.id, documentId: documentRow.id }, adminSession,
    } as unknown as Request, res);
    expect(state.status).toBe(200);
    const body = state.body as { ok: boolean; url: string; expiresAt: string };
    expect(body.ok).toBe(true);
    expect(body.url).toContain('/object/sign/');
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(JSON.stringify(body)).not.toContain('cases/abcdef');
    expect(mocks.auditEntries).toHaveLength(1);
    expect(mocks.auditEntries[0]).toMatchObject({
      action: 'admin_kyc_case_document_viewed',
      adminId: 'admin-reviewer',
      target: 'kyc_case_document',
      targetId: documentRow.id,
    });
    expect(JSON.stringify(mocks.auditEntries[0])).not.toContain('cases/abcdef');
  });

  it('maps a storage failure to a clean 503 without auditing a success', async () => {
    mocks.configured = true;
    mocks.documentRows = [documentRow];
    mocks.signed = { ok: false, url: '', error: 'bucket missing' };
    vi.stubEnv('SUPABASE_URL', 'https://stub.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'stub-service-key');
    const handler = (await import('../../server/api/admin/kyc-cases/[id]/documents/[documentId]/GET.js')).default;
    const { res, state } = responseDouble();
    await handler({
      params: { id: caseRow.id, documentId: documentRow.id }, adminSession,
    } as unknown as Request, res);
    expect(state.status).toBe(503);
    expect(mocks.auditEntries).toHaveLength(0);
  });
});

describe('per-account-type flow completeness', () => {
  const fieldNames = (type: keyof typeof APPLICATION_FLOWS, stepId: string): string[] => {
    const step = APPLICATION_FLOWS[type].find(s => s.id === stepId);
    return step ? step.fields.map(f => f.name) : [];
  };

  it('keeps the KYC case lifecycle statuses aligned with the review contract', async () => {
    const store = await import('../../server/lib/kycCaseStore.js');
    expect(store.KYC_CASE_STATUSES).toEqual([
      'DRAFT', 'EMAIL_VERIFICATION_REQUIRED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW',
      'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'EXPIRED',
    ]);
    expect(store.DOCUMENT_TYPES).toEqual(['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'RESIDENCE_PERMIT']);
  });

  it('collects the KYC identity base and preferences for personal accounts', () => {
    const personal = fieldNames('PERSONAL', 'preferences');
    expect(personal).toEqual(expect.arrayContaining(['intendedUse', 'employmentCategory', 'activityRange', 'primaryCurrency']));
    const identity = fieldNames('PERSONAL', 'personal');
    expect(identity).toEqual(expect.arrayContaining(['firstName', 'middleName', 'lastName', 'dob', 'nationality', 'address', 'city', 'region', 'postalCode', 'phone']));
  });

  it('extends savings with the source of funds category', () => {
    expect(fieldNames('SAVINGS', 'savings')).toEqual(expect.arrayContaining([
      'purpose', 'goal', 'targetAmount', 'currency', 'autoSave', 'sourceOfFunds',
    ]));
  });

  it('collects the full KYB set for business accounts', () => {
    expect(fieldNames('BUSINESS', 'business')).toEqual(expect.arrayContaining([
      'legalName', 'tradingName', 'registrationNumber', 'incorporationCountry', 'entityType',
      'registeredAddress', 'operatingAddress', 'industry', 'description', 'website',
      'monthlyActivity', 'transactionVolume', 'requiredCurrencies',
    ]));
    expect(fieldNames('BUSINESS', 'ownership')).toEqual(expect.arrayContaining(['directors', 'beneficialOwners']));
  });

  it('extends multi-currency with monthly volume and source of funds', () => {
    expect(fieldNames('MULTI_CURRENCY', 'multiCurrency')).toEqual(expect.arrayContaining([
      'primaryCurrency', 'requiredCurrencies', 'activityCountries', 'internationalTransfers',
      'fxUsage', 'monthlyVolume', 'sourceOfFunds',
    ]));
  });

  it('extends wealth with source of wealth and source of funds categories', () => {
    expect(fieldNames('WEALTH', 'wealth')).toEqual(expect.arrayContaining([
      'objectives', 'experience', 'sourceOfWealth', 'sourceOfFunds', 'serviceRequirements',
      'reportingCurrency', 'supportPreference',
    ]));
  });
});
