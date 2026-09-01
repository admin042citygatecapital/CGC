import { describe, expect, it } from 'vitest';
import { assertMakerChecker, validateEvidenceReference } from '../../server/lib/onboardingStore';
import { allowedRolesForAdminRequest } from '../../server/lib/adminAuthorizationMiddleware';
import fs from 'node:fs';
import path from 'node:path';

describe('customer onboarding controls', () => {
  it('rejects self-review by the submitter or last editor', () => {
    expect(() => assertMakerChecker({ submittedBy: 'admin-a', lastEditedBy: 'customer-1' }, 'admin-a'))
      .toThrow(/cannot review/i);
    expect(() => assertMakerChecker({ submittedBy: 'customer-1', lastEditedBy: 'admin-b' }, 'admin-b'))
      .toThrow(/cannot review/i);
    expect(() => assertMakerChecker({ submittedBy: 'customer-1', lastEditedBy: 'customer-1' }, 'admin-c'))
      .not.toThrow();
  });

  it('validates metadata-only evidence references', () => {
    expect(validateEvidenceReference({ referenceType: 'provider', reference: 'provider-case-123' })).toBeNull();
    expect(validateEvidenceReference({ referenceType: 'provider', reference: 'https://example.com/document' })).toMatch(/opaque reference/);
    expect(validateEvidenceReference({ referenceType: 'controlled_url', reference: 'http://example.com/evidence' })).toMatch(/HTTPS/);
    expect(validateEvidenceReference({ referenceType: 'controlled_url', reference: 'https://user:pass@example.com/evidence' })).toMatch(/credentials/);
    expect(validateEvidenceReference({ referenceType: 'internal', reference: 'case/123', sha256: 'A'.repeat(64) })).toMatch(/SHA-256/);
    expect(validateEvidenceReference({ referenceType: 'internal', reference: 'case/123', sha256: 'a'.repeat(64) })).toBeNull();
    expect(validateEvidenceReference({ referenceType: 'internal', reference: 'case/123', issuedAt: '2026-02-02', expiresAt: '2026-01-01' })).toMatch(/after issue/);
  });

  it('limits onboarding decisions to compliance administrators and super-admin', () => {
    expect(allowedRolesForAdminRequest('/onboarding/review', 'POST')).toEqual([]);
    expect(allowedRolesForAdminRequest('/users/action', 'POST')).toEqual([]);
  });

  it('migrates append-only lifecycle history and metadata-only evidence', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'src/server/db/migrations/0008_customer_onboarding.sql'), 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS onboarding_cases');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS onboarding_evidence');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS onboarding_events');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS compliance_cases');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS compliance_case_events');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON onboarding_events');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON compliance_case_events');
    expect(sql).not.toMatch(/BYTEA|document_base64|password_hash/i);
  });

  it('migrates an ongoing screening schedule without storing raw screening documents', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'src/server/db/migrations/0013_ongoing_screening.sql'), 'utf8');
    expect(sql).toContain('screening_status');
    expect(sql).toContain('next_screening_at');
    expect(sql).toContain("purpose IN ('onboarding', 'rescreen')");
    expect(sql).not.toMatch(/BYTEA|document_base64|credential_value|raw_payload/i);
    expect(allowedRolesForAdminRequest('/onboarding/screening', 'GET')).toEqual([]);
  });

  it('does not expose raw identity, bank, wallet, or document fields in the general directory', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/server/api/admin/users/GET.ts'), 'utf8');
    expect(source).not.toMatch(/bankAccountNumber:\s*u\.|walletBtc:\s*u\.|idNumber:\s*u\.|idDocumentUrl:\s*u\.|selfieUrl:\s*u\./);
  });

  it('removes legacy administrator bypasses for verification and compliance states', () => {
    const editor = fs.readFileSync(path.join(process.cwd(), 'src/server/api/admin/users/edit/POST.ts'), 'utf8');
    const override = fs.readFileSync(path.join(process.cwd(), 'src/server/api/admin/users/override/POST.ts'), 'utf8');
    expect(editor).not.toMatch(/'status',\s*'kycStatus'|'emailVerified'.*ALLOWED_FIELDS/s);
    expect(override).not.toContain("'manual_verify'");
    expect(override).toContain('Activation cannot bypass compliance');
  });

  it('versions every submitted and reviewed registration transition', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/server/lib/onboardingStore.ts'), 'utf8');
    const submitTransition = source.slice(source.indexOf('export async function submitOnboardingCase'), source.indexOf('export async function reviewOnboardingCase'));
    const reviewTransition = source.slice(source.indexOf('export async function reviewOnboardingCase'), source.indexOf('export async function getOnboardingCaseBundle'));
    expect(submitTransition).toContain('const nextVersion = current.version + 1');
    expect(submitTransition).toContain('version: nextVersion');
    expect(submitTransition).toContain('previousVersion: current.version');
    expect(submitTransition).toContain('db.transaction(async tx =>');
    expect(submitTransition).toContain('eq(onboardingCases.version, current.version)');
    expect(submitTransition).toContain("code: 'WORKFLOW_CONFLICT'");
    expect(reviewTransition).toContain('const nextVersion = current.version + 1');
    expect(reviewTransition).toContain('version: nextVersion');
    expect(reviewTransition).toContain('previousVersion: current.version');
    expect(reviewTransition).toContain('db.transaction(async tx =>');
    expect(reviewTransition).toContain('eq(onboardingCases.version, current.version)');
    expect(reviewTransition).toContain("code: 'WORKFLOW_CONFLICT'");
  });

  it('supports a controlled request-more-information and corrected resubmission cycle', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/server/lib/onboardingStore.ts'), 'utf8');
    const submitTransition = source.slice(source.indexOf('export async function submitOnboardingCase'), source.indexOf('export async function reviewOnboardingCase'));
    const reviewService = fs.readFileSync(path.join(process.cwd(), 'src/server/lib/kycReviewService.ts'), 'utf8');

    expect(submitTransition).toContain("['draft', 'needs_info'].includes(current.status)");
    expect(submitTransition).toContain('requested.filter(kind => !uploaded.has(kind))');
    expect(submitTransition).toContain('requestedEvidenceKinds: []');
    expect(submitTransition).toContain('customerInstructions: null');
    expect(submitTransition).toContain('fromStatus: current.status');
    expect(reviewService).toContain("input.decision === 'needs_info'");
    expect(reviewService).toContain('requestedEvidenceKinds.length === 0');
    expect(reviewService).toContain('requestId');
    expect(reviewService).toContain('auditLog');
  });

  it('maintains separate full-intake and compliance-review queues', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/server/lib/onboardingStore.ts'), 'utf8');
    const intake = source.slice(source.indexOf('export async function getRegistrationIntakePosition'), source.indexOf('export async function listOnboardingQueueIds'));
    expect(intake).toContain('listRegistrationIntakeQueueIds');
    expect(intake).toContain("['draft', 'submitted', 'under_review', 'needs_info', 'approved']");
    expect(intake).not.toMatch(/rejected|expired/);
    const adminRoute = fs.readFileSync(path.join(process.cwd(), 'src/server/api/admin/onboarding/GET.ts'), 'utf8');
    expect(adminRoute).toContain('intakePosition');
    expect(adminRoute).toContain('queuePosition');
  });

  it('publishes a jurisdiction-labelled programme register with no activation effect', () => {
    const map = fs.readFileSync(path.join(process.cwd(), 'src/server/lib/onboardingComplianceMap.ts'), 'utf8');
    const route = fs.readFileSync(path.join(process.cwd(), 'src/server/api/admin/onboarding/GET.ts'), 'utf8');
    const page = fs.readFileSync(path.join(process.cwd(), 'src/pages/admin/onboarding.tsx'), 'utf8');
    for (const key of [
      'identity_case_lifecycle', 'identity_provider', 'verification_tiers', 'beneficial_ownership',
      'sanctions_pep_screening', 'transaction_monitoring', 'admin_audit_maker_checker',
      'daily_reconciliation', 'customer_notifications', 'disputes_error_resolution',
      'us_cip_bsa_programme', 'us_sar_ctr_workflows', 'statements_tax_documents',
    ]) expect(map).toContain(`key: '${key}'`);
    expect(map).toContain("activationEffect: 'NONE'");
    expect(route).toContain("launchJurisdiction: 'UNDECIDED'");
    expect(route).toContain('filingsEnabled: false');
    expect(route).toContain('ONBOARDING_COMPLIANCE_MAP');
    expect(page).toContain('Onboarding and compliance programme register');
    expect(page).toContain('ACTIVATION NONE');
  });
});
