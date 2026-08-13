import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import type { SponsorEvidenceRow, SponsorPackageRow } from '../../server/db/schema.js';
import { allowedRolesForAdminRequest } from '../../server/lib/adminAuthorizationMiddleware.js';
import { LIVE_PROVIDER_ADAPTERS_IMPLEMENTED } from '../../server/lib/platformMode.js';
import { validateProviderCommand, validateProviderEnvelope } from '../../server/lib/providerContracts.js';
import { SPONSOR_CONTROLS, canManageCategory } from '../../server/lib/sponsorReadinessCatalogue.js';
import { buildSponsorPackFiles, buildSponsorPackZip } from '../../server/lib/sponsorReadinessExport.js';
import {
  SponsorReadinessError, assertMakerChecker, buildSponsorReadinessSnapshot,
  assertSponsorCategoryOwnership, deriveLegalEntityState, effectiveEvidenceStatus, validateEvidenceInput,
} from '../../server/lib/sponsorReadinessStore.js';

describe('legal entity state', () => {
  it('requires both entity and beneficial-owner evidence to be approved', () => {
    expect(deriveLegalEntityState([])).toBe('unverified');
    expect(deriveLegalEntityState([{ controlKey: 'legal_entity_verified', status: 'submitted' }])).toBe('evidence_pending');
    expect(deriveLegalEntityState([{ controlKey: 'legal_entity_verified', status: 'approved' }])).toBe('evidence_pending');
    expect(deriveLegalEntityState([
      { controlKey: 'legal_entity_verified', status: 'approved' },
      { controlKey: 'beneficial_owners_verified', status: 'approved' },
    ])).toBe('verified');
  });
});

const packageRow: SponsorPackageRow = {
  id: 'uk-multicurrency-v1', version: '1.0', jurisdiction: 'United Kingdom',
  legalEntityState: 'unverified', status: 'draft', submittedBy: null,
  submittedAt: null, reviewedBy: null, reviewedAt: null, reviewNote: null,
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function evidence(controlKey: string, overrides: Partial<SponsorEvidenceRow> = {}): SponsorEvidenceRow {
  return {
    id: `e_${controlKey}`, packageId: packageRow.id, controlKey, title: controlKey,
    status: 'approved', referenceType: 'internal', reference: `CGC-${controlKey}`,
    sha256: 'a'.repeat(64), owner: 'Control owner', issuedAt: null, expiresAt: null,
    notes: null, createdBy: 'maker', lastEditedBy: 'maker', submittedBy: 'maker',
    submittedAt: new Date('2026-01-01T00:00:00Z'), reviewedBy: 'checker',
    reviewedAt: new Date('2026-01-02T00:00:00Z'), reviewNote: 'Independently reviewed',
    createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  };
}

describe('sponsor readiness lifecycle and validation', () => {
  it('validates controlled references, hashes and dates', () => {
    const valid = validateEvidenceInput({ controlKey: SPONSOR_CONTROLS[0].key, title: 'Ownership register', referenceType: 'url', reference: 'https://evidence.example.test/legal/ownership', sha256: 'ABCDEF'.repeat(10) + 'ABCD', owner: 'Compliance officer', issuedAt: '2026-01-01', expiresAt: '2027-01-01' });
    expect(valid.sha256).toBe('abcdef'.repeat(10) + 'abcd');
    expect(() => validateEvidenceInput({ controlKey: SPONSOR_CONTROLS[0].key, title: 'Bad URL', referenceType: 'url', reference: 'http://example.test/file', sha256: 'a'.repeat(64), owner: 'Owner' })).toThrow(SponsorReadinessError);
    expect(() => validateEvidenceInput({ controlKey: SPONSOR_CONTROLS[0].key, title: 'Bad hash', referenceType: 'internal', reference: 'CGC-LEGAL-1', sha256: '1234', owner: 'Owner' })).toThrow(/64-character/);
  });

  it('enforces maker-checker and detects expiry', () => {
    expect(() => assertMakerChecker({ submittedBy: 'admin-a', lastEditedBy: 'admin-b' }, 'admin-a')).toThrow(/Maker-checker/);
    expect(() => assertMakerChecker({ submittedBy: 'admin-a', lastEditedBy: 'admin-b' }, 'admin-c')).not.toThrow();
    expect(effectiveEvidenceStatus(evidence('legal_entity_verified', { expiresAt: new Date('2025-01-01') }), new Date('2026-01-01'))).toBe('expired');
  });

  it('keeps role ownership narrow while allowing all three control-plane roles to enter the workspace', () => {
    expect(allowedRolesForAdminRequest('/sponsor-readiness/evidence/x/review', 'POST')).toEqual([]);
    expect(allowedRolesForAdminRequest('/provider-sandbox', 'POST')).toEqual([]);
    expect(canManageCategory('FINANCE_ADMIN', 'ledger_reconciliation')).toBe(true);
    expect(canManageCategory('FINANCE_ADMIN', 'aml_sanctions')).toBe(false);
    expect(canManageCategory('COMPLIANCE_ADMIN', 'aml_sanctions')).toBe(true);
    expect(canManageCategory('SECURITY_ADMIN', 'privacy')).toBe(true);
    expect(canManageCategory('SUPPORT_ADMIN', 'privacy')).toBe(false);
    expect(() => assertSponsorCategoryOwnership('authoritative_ledger', { id: 'compliance-admin', role: 'COMPLIANCE_ADMIN' })).toThrow(/does not own/);
    expect(() => assertSponsorCategoryOwnership('authoritative_ledger', { id: 'external_checker_12345678', role: 'COMPLIANCE_ADMIN' })).not.toThrow();
  });
});

describe('sponsor provider pack', () => {
  it('reports preparation separately from independent approval', () => {
    const draft = evidence('consumer_kyc_policy', {
      status: 'draft', submittedBy: null, submittedAt: null,
      reviewedBy: null, reviewedAt: null, reviewNote: null,
    });
    const snapshot = buildSponsorReadinessSnapshot(packageRow, [draft], []);
    expect(snapshot.summary).toMatchObject({
      total: SPONSOR_CONTROLS.length,
      prepared: 1,
      preparedPercent: Math.round(100 / SPONSOR_CONTROLS.length),
      approved: 0,
      percent: 0,
      lifecycle: { draft: 1, submitted: 0, approved: 0, rejected: 0, expired: 0, missing: SPONSOR_CONTROLS.length - 1 },
      fullyReviewed: false,
      sponsorSubmissionReady: false,
    });
  });

  it('exposes the five external acquisition requirements without treating them as evidence', () => {
    const snapshot = buildSponsorReadinessSnapshot(packageRow, [], []);
    expect(snapshot.externalEvidenceRequirements.map(item => item.controlKey)).toEqual([
      'legal_entity_verified', 'beneficial_owners_verified', 'regulatory_perimeter_opinion',
      'sponsor_term_sheet', 'programme_contract',
    ]);
    expect(snapshot.externalEvidenceRequirements.every(item => item.status === 'missing')).toBe(true);
    expect(snapshot.externalEvidenceRequirements.every(item => item.authority.length > 40 && item.minimumAcceptance.length > 40 && item.insufficientEvidence.length > 30)).toBe(true);
    expect(snapshot.evidence).toHaveLength(0);
    expect(snapshot.financialOperationsLocked).toBe(true);
  });

  it('exports deterministic draft contents without source documents or credentials', () => {
    const snapshot = buildSponsorReadinessSnapshot(packageRow, [], []);
    const first = buildSponsorPackZip(snapshot);
    const second = buildSponsorPackZip(snapshot);
    expect(first).toEqual(second);
    const archive = unzipSync(first);
    expect(Object.keys(archive).sort()).toEqual([
      '01-executive-proposition.md', '02-phased-product-scope.md', '03-flow-of-funds.md',
      '04-responsibility-matrix.csv', '05-control-evidence-register.csv',
      '06-provider-integration-spec.md', '07-sponsor-rfp.md', '08-gaps-and-dependencies.md',
      '09-safeguarding-reconciliation-procedure.md', '10-privacy-and-data-rights-procedure.md',
      '11-incident-breach-response-procedure.md', '12-disaster-recovery-exercise-procedure.md',
      '13-provider-failure-and-exit-procedure.md', '14-returns-reversals-and-remediation-procedure.md',
      '15-vulnerable-customer-support-procedure.md',
      '16-double-entry-ledger-integration-procedure.md', '17-cross-border-data-transfer-mapping-procedure.md',
      '18-business-kyb-and-ownership-procedure.md',
      '19-enterprise-aml-risk-assessment-procedure.md', '20-transaction-monitoring-governance-procedure.md',
      '21-customer-terms-and-disclosure-approval-procedure.md',
      '22-sponsor-provider-responsibility-matrix.md', '23-safeguarding-structure-and-assurance-plan.md',
      '24-identity-screening-provider-due-diligence.md', '25-compliance-officer-mandate.md',
      '26-fx-and-payment-corridor-governance.md', '27-independent-penetration-test-plan.md',
      '28-customer-funds-wording-approval.md',
      '29-external-evidence-acquisition-register.md',
      '30-external-evidence-acquisition-register.csv',
      'README.md', 'evidence-manifest.json',
    ]);
    const allText = Object.values(archive).map(value => strFromU8(value)).join('\n');
    expect(allText).toContain('DRAFT — NOT APPROVED FOR LAUNCH');
    expect(allText).toContain('financialOperationsLocked');
    expect(allText).toContain('SPONSOR AND COUNSEL APPROVAL REQUIRED');
    expect(allText).toContain('A different authorised checker');
    expect(allText).toContain('Incident Commander');
    expect(allText).toContain('real-funds lock');
    expect(allText).toContain('A draft playbook or synthetic rehearsal is not provider operating evidence');
    expect(allText).toContain('No administrator may directly edit a customer balance');
    expect(allText).toContain('Never weaken authentication, fraud, sanctions or safeguarding controls');
    expect(allText).toContain('Existing application balances and transactions are demonstration projections');
    expect(allText).toContain('This procedure is a mapping method, not a completed transfer assessment');
    expect(allText).toContain('KYB approval does not create a live account or enable payments');
    expect(allText).toContain('it is not a completed enterprise risk assessment');
    expect(allText).toContain('No production transaction-monitoring programme is active');
    expect(allText).toContain('Existing pre-deployment terms are not suitable for live financial services');
    expect(allText).toContain('not an executed responsibility schedule');
    expect(allText).toContain('No safeguarding structure, account, reviewer or assurance conclusion is approved');
    expect(allText).toContain('does not select, endorse or connect a provider');
    expect(allText).toContain('This draft defines a mandate, not a person');
    expect(allText).toContain('No provider, price, currency or corridor is approved');
    expect(allText).toContain('This is a test plan, not a penetration-test report');
    expect(allText).toContain('This workflow does not approve live customer-funds claims');
    expect(allText).toContain('cannot be created or self-attested by the project team');
    expect(allText).toContain('legal_entity_verified');
    expect(allText).toContain('beneficial_owners_verified');
    expect(allText).toContain('regulatory_perimeter_opinion');
    expect(allText).toContain('sponsor_term_sheet');
    expect(allText).toContain('programme_contract');
    expect(allText).toContain('must never be used as a substitute for the evidence it describes');
    expect(allText).not.toMatch(/RESEND_API_KEY|DATABASE_URL|BEGIN PRIVATE KEY/);
    const externalRegister = strFromU8(archive['30-external-evidence-acquisition-register.csv']);
    expect(externalRegister).toContain('legal_entity_verified');
    expect(externalRegister).toContain('programme_contract');
    expect(externalRegister).toContain('missing');
    const manifest = JSON.parse(strFromU8(archive['evidence-manifest.json'])) as {
      externalEvidenceRequirements: Array<{ controlKey: string; status: string }>;
      financialOperationsLocked: boolean;
    };
    expect(manifest.externalEvidenceRequirements).toHaveLength(5);
    expect(manifest.externalEvidenceRequirements.every(item => item.status === 'missing')).toBe(true);
    expect(manifest.financialOperationsLocked).toBe(true);
  });

  it('only marks a fully evidenced and final-approved package submission ready', () => {
    const allEvidence = SPONSOR_CONTROLS.map(control => evidence(control.key));
    const approvedPackage = { ...packageRow, status: 'approved' as const, submittedBy: 'super-a', reviewedBy: 'super-b' };
    expect(buildSponsorReadinessSnapshot(approvedPackage, allEvidence, []).summary.sponsorSubmissionReady).toBe(false);
    const entity = { id: 'le_test', status: 'verified', expiresAt: new Date('2030-01-01') } as any;
    const owner = { id: 'bor_test', entityId: 'le_test', active: true, status: 'verified', expiresAt: new Date('2030-01-01') } as any;
    const snapshot = buildSponsorReadinessSnapshot(approvedPackage, allEvidence, [], entity, [owner]);
    expect(snapshot.summary.sponsorSubmissionReady).toBe(true);
    expect(buildSponsorPackFiles(snapshot).README).toBeUndefined();
    expect(buildSponsorPackFiles(snapshot)['README.md']).toContain('SPONSOR SUBMISSION READY');
    expect(snapshot.financialOperationsLocked).toBe(true);
    expect(LIVE_PROVIDER_ADAPTERS_IMPLEMENTED).toBe(false);
  });
});

describe('provider-neutral integration contract safeguards', () => {
  it('requires idempotency, correlation, signature, timestamp and replay identifiers', () => {
    expect(validateProviderCommand({})).toEqual(['idempotencyKey is required', 'correlationId is required']);
    expect(validateProviderCommand({ idempotencyKey: 'idem-1', correlationId: 'corr-1' })).toEqual([]);
    expect(validateProviderEnvelope({})).toHaveLength(3);
    expect(validateProviderEnvelope({ eventId: 'evt-1', timestamp: new Date().toISOString(), signature: 'sig' })).toEqual([]);
  });

  it('has schema checks and database-level append-only history protection', () => {
    const migration = readFileSync('src/server/db/migrations/0006_sponsor_readiness.sql', 'utf8');
    expect(migration).toContain('sponsor_evidence_sha256_check');
    expect(migration).toContain('sponsor_evidence_dates_check');
    expect(migration).toContain('append-only');
    expect(migration).toContain('BEFORE UPDATE OR DELETE');
  });
});
