import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dependencies = vi.hoisted(() => ({
  getSecret: vi.fn(),
  reviewSponsorEvidence: vi.fn(),
  reviewSponsorPackage: vi.fn(),
  getSponsorReadiness: vi.fn(),
  getLegalEntityVerification: vi.fn(),
  reviewLegalEntity: vi.fn(),
  reviewBeneficialOwner: vi.fn(),
}));
vi.mock('#runtime/secrets', () => ({ getSecret: dependencies.getSecret }));
vi.mock('../../server/lib/sponsorReadinessStore.js', () => ({
  reviewSponsorEvidence: dependencies.reviewSponsorEvidence,
  reviewSponsorPackage: dependencies.reviewSponsorPackage,
  getSponsorReadiness: dependencies.getSponsorReadiness,
}));
vi.mock('../../server/lib/legalEntityVerificationStore.js', () => ({
  getLegalEntityVerification: dependencies.getLegalEntityVerification,
  reviewLegalEntity: dependencies.reviewLegalEntity,
  reviewBeneficialOwner: dependencies.reviewBeneficialOwner,
}));
vi.mock('../../server/lib/sponsorReadinessHttp.js', () => ({
  sponsorError: (res: { status: (code: number) => { json: (body: unknown) => unknown } }, error: Error & { status?: number; code?: string }) => res.status(error.status ?? 400).json({ error: error.message, code: error.code }),
}));

import getHandler from '../../server/api/admin/sponsor-readiness/external-review/GET.js';
import postHandler from '../../server/api/admin/sponsor-readiness/external-review/POST.js';

const key = 'independent-reviewer-test-key-with-strong-length';
const keyHash = crypto.createHash('sha256').update(key).digest('hex');

function response() {
  const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() };
  res.status.mockReturnValue(res); res.json.mockReturnValue(res);
  return res;
}
function request(body: Record<string, unknown>, suppliedKey = key) {
  return { body, headers: { 'x-sponsor-reviewer-key': suppliedKey }, ip: '127.0.0.1' };
}

describe('independent sponsor reviewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getSecret.mockImplementation((name: string) => name === 'SPONSOR_REVIEWER_KEY_HASH' ? keyHash : name === 'SPONSOR_REVIEWER_EMAIL' ? 'reviewer@example.test' : undefined);
    dependencies.reviewSponsorEvidence.mockResolvedValue(undefined);
    dependencies.reviewSponsorPackage.mockResolvedValue(undefined);
    dependencies.reviewLegalEntity.mockResolvedValue(undefined);
    dependencies.reviewBeneficialOwner.mockResolvedValue(undefined);
    dependencies.getLegalEntityVerification.mockResolvedValue({
      entity: { id: 'le_12345678', legalName: 'Candidate Entity Limited', jurisdiction: 'United Kingdom', registrationNumber: '12345678', legalForm: 'Private limited company', registryUrl: 'https://find-and-update.company-information.service.gov.uk/company/12345678', registrySha256: 'c'.repeat(64), expiresAt: null, submittedAt: new Date('2026-01-03'), effectiveStatus: 'submitted' },
      owners: [{ id: 'bor_12345678', controllerRef: 'controller-01', ownershipBand: '75-100', controlNature: 'Ownership of shares', providerCode: 'sumsub', providerRef: 'provider-ref-01', evidenceSha256: 'd'.repeat(64), expiresAt: null, submittedAt: new Date('2026-01-03'), effectiveStatus: 'submitted' }],
      assessment: { entityVerified: false, ownersVerified: false, verified: false, activeOwnerCount: 1 },
      events: [], financialOperationsLocked: true,
    });
    dependencies.getSponsorReadiness.mockResolvedValue({
      package: { id: 'uk-multicurrency-v1', version: '1.0', status: 'draft', label: 'DRAFT — NOT APPROVED FOR LAUNCH', submittedAt: null },
      evidence: [
        { id: 'sev_12345678', controlKey: 'authoritative_ledger', title: 'Ledger evidence', effectiveStatus: 'submitted', referenceType: 'internal', reference: 'CGC-LEDGER-001', sha256: 'a'.repeat(64), owner: 'Finance owner', issuedAt: new Date('2026-01-01'), expiresAt: null, notes: 'Controlled metadata', submittedAt: new Date('2026-01-02'), createdBy: 'admin-secret-id', lastEditedBy: 'admin-secret-id' },
        { id: 'sev_87654321', controlKey: 'consumer_kyc_policy', title: 'Draft KYC', effectiveStatus: 'draft', referenceType: 'internal', reference: 'CGC-KYC-001', sha256: 'b'.repeat(64), owner: 'Compliance owner', issuedAt: null, expiresAt: null, notes: null, submittedAt: null, createdBy: 'admin-secret-id', lastEditedBy: 'admin-secret-id' },
      ],
      summary: { approved: 0, total: 37, outstanding: 38 },
      gaps: [{ key: 'legal_entity_verified', title: 'Legal entity', status: 'draft', ownerRole: 'COMPLIANCE_ADMIN' }],
      financialOperationsLocked: true,
    });
  });

  it('returns only submitted evidence metadata and keeps identities and operations isolated', async () => {
    const res = response();
    await getHandler(request({}) as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, max-age=0');
    const payload = res.json.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      ok: true,
      reviewer: { id: expect.stringMatching(/^external_checker_[a-f0-9]{16}$/) },
      financialOperationsLocked: true,
      queue: { summary: { submittedEvidence: 1, submittedStructuredRecords: 2, approvedControls: 0, totalControls: 37 } },
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).toContain('sev_12345678');
    expect(serialized).toContain('le_12345678');
    expect(serialized).toContain('bor_12345678');
    expect(serialized).not.toContain('sev_87654321');
    expect(serialized).not.toContain('admin-secret-id');
    expect(serialized).not.toContain('reviewer@example.test');
    expect(serialized).not.toContain('events');
  });

  it('reviews submitted evidence without creating a second administrator session', async () => {
    const res = response();
    await postHandler(request({ target: 'evidence', evidenceId: 'sev_12345678', decision: 'approved', note: 'Independently checked against controlled evidence.' }) as never, res as never);

    expect(dependencies.reviewSponsorEvidence).toHaveBeenCalledWith('sev_12345678', 'approved', expect.any(String), expect.objectContaining({
      id: expect.stringMatching(/^external_checker_/), role: 'COMPLIANCE_ADMIN',
    }));
    expect(dependencies.reviewSponsorPackage).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, target: 'evidence', decision: 'approved' }));
  });

  it('reviews the final package through the same isolated credential', async () => {
    const res = response();
    await postHandler(request({ target: 'package', decision: 'rejected', note: 'Outstanding external approval evidence remains.' }) as never, res as never);
    expect(dependencies.reviewSponsorPackage).toHaveBeenCalledWith('rejected', expect.any(String), expect.objectContaining({ id: expect.stringMatching(/^external_checker_/) }));
  });

  it('reviews structured entity and controller records only through the isolated checker', async () => {
    const entity = response();
    await postHandler(request({ target: 'legal_entity', decision: 'approved', note: 'Registry and authority evidence independently verified.' }) as never, entity as never);
    expect(dependencies.reviewLegalEntity).toHaveBeenCalledWith('verified', expect.any(String), expect.objectContaining({ id: expect.stringMatching(/^external_checker_/) }));

    const owner = response();
    await postHandler(request({ target: 'beneficial_owner', recordId: 'bor_12345678', decision: 'rejected', note: 'Provider verification scope is incomplete.' }) as never, owner as never);
    expect(dependencies.reviewBeneficialOwner).toHaveBeenCalledWith('bor_12345678', 'rejected', expect.any(String), expect.objectContaining({ id: expect.stringMatching(/^external_checker_/) }));
  });

  it('rejects an invalid credential and malformed evidence identifier', async () => {
    const badKey = response();
    await postHandler(request({ target: 'package', decision: 'approved', note: 'Independent approval.' }, 'wrong-key') as never, badKey as never);
    expect(badKey.status).toHaveBeenCalledWith(403);

    const badId = response();
    await postHandler(request({ target: 'evidence', evidenceId: '../secret', decision: 'approved', note: 'Independent approval.' }) as never, badId as never);
    expect(badId.status).toHaveBeenCalledWith(400);
    expect(dependencies.reviewSponsorEvidence).not.toHaveBeenCalled();
  });

  it('refuses to treat the super-administrator identity as an independent checker', async () => {
    dependencies.getSecret.mockImplementation((name: string) => name === 'SPONSOR_REVIEWER_KEY_HASH' ? keyHash : name === 'SPONSOR_REVIEWER_EMAIL' || name === 'ADMIN_EMAIL' ? 'admin@citygate.capital' : undefined);
    const res = response();
    await getHandler(request({}) as never, res as never);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(dependencies.getSponsorReadiness).not.toHaveBeenCalled();
  });
});
