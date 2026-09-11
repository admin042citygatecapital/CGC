import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BeneficialOwnerRecordRow, LegalEntityProfileRow } from '../../server/db/schema.js';
import { allowedRolesForAdminRequest } from '../../server/lib/adminAuthorizationMiddleware.js';
import { assessLegalEntityVerification, assertEntityAuthorityComplete, assertLegalEntityMakerChecker, assertLegalEntityReviewOwnership } from '../../server/lib/legalEntityVerificationStore.js';
import { deriveStructuredLegalEntityState } from '../../server/lib/sponsorReadinessStore.js';

describe('legal entity and beneficial ownership verification', () => {
  const now = new Date('2026-08-11T00:00:00.000Z');
  const future = new Date('2027-08-11T00:00:00.000Z');
  // Partial row fixtures: the verification helpers only read the fields set below.
  const entity = { status: 'verified', expiresAt: future, registrySha256: 'a'.repeat(64), authorityType: 'board_resolution', authorityReference: 'AUTH-2026-001', authoritySha256: 'b'.repeat(64), authorizedOfficerRef: 'officer-01', authorityIssuedAt: new Date('2026-08-01'), authorityExpiresAt: future } as unknown as LegalEntityProfileRow;
  const owner = { active: true, status: 'verified', expiresAt: future } as unknown as BeneficialOwnerRecordRow;

  it('requires a current verified entity and every active controller', () => {
    expect(deriveStructuredLegalEntityState(entity, [owner], now)).toBe('verified');
    expect(deriveStructuredLegalEntityState(entity, [], now)).toBe('evidence_pending');
    expect(deriveStructuredLegalEntityState(entity, [{ ...owner, status: 'submitted' }], now)).toBe('evidence_pending');
    expect(deriveStructuredLegalEntityState({ ...entity, expiresAt: new Date('2026-01-01') }, [owner], now)).toBe('evidence_pending');
    expect(assessLegalEntityVerification({ ...entity, effectiveStatus: 'verified' }, [{ ...owner, effectiveStatus: 'verified' }]).verified).toBe(true);
    expect(assessLegalEntityVerification({ ...entity, effectiveStatus: 'verified' }, []).verified).toBe(false);
  });

  it('enforces maker-checker for entity and controller reviews', () => {
    expect(() => assertLegalEntityMakerChecker({ submittedBy: 'admin-a', lastEditedBy: 'admin-a' }, 'admin-a')).toThrow(expect.objectContaining({ code: 'MAKER_CHECKER_VIOLATION' }));
    expect(() => assertLegalEntityMakerChecker({ submittedBy: 'admin-a', lastEditedBy: 'admin-a' }, 'admin-b')).not.toThrow();
    expect(() => assertLegalEntityReviewOwnership({ id: 'super-admin', email: 'admin@example.test', role: 'SUPER_ADMIN' })).toThrow(expect.objectContaining({ code: 'INDEPENDENT_CHECKER_REQUIRED' }));
    expect(() => assertLegalEntityReviewOwnership({ id: 'external_checker_1234567890abcdef', email: 'reviewer@example.test', role: 'COMPLIANCE_ADMIN' })).not.toThrow();
  });

  it('requires separate current authority evidence in addition to a public registry match', () => {
    expect(() => assertEntityAuthorityComplete(entity, now)).not.toThrow();
    expect(() => assertEntityAuthorityComplete({ ...entity, authorityReference: null }, now)).toThrow(expect.objectContaining({ code: 'AUTHORITY_EVIDENCE_REQUIRED' }));
    expect(() => assertEntityAuthorityComplete({ ...entity, authorityExpiresAt: new Date('2026-01-01') }, now)).toThrow(expect.objectContaining({ code: 'AUTHORITY_EVIDENCE_EXPIRED' }));
    expect(deriveStructuredLegalEntityState({ ...entity, authorityReference: null }, [owner], now)).toBe('evidence_pending');
  });

  it('limits the register to Compliance administrators and Super Admin', () => {
    expect(allowedRolesForAdminRequest('/legal-entity', 'GET')).toEqual([]);
    expect(allowedRolesForAdminRequest('/legal-entity/owners', 'POST')).toEqual([]);
  });

  it('migrates metadata-only records with immutable history', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'src/server/db/migrations/0014_legal_entity_verification.sql'), 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS legal_entity_profiles');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS beneficial_owner_records');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON legal_entity_verification_events');
    expect(sql).toContain("registry_url ~ '^https://'");
    expect(sql).not.toMatch(/date_of_birth|residential_address|document_base64|password|secret_value/i);
    const authoritySql = fs.readFileSync(path.join(process.cwd(), 'src/server/db/migrations/0024_legal_entity_authority.sql'), 'utf8');
    expect(authoritySql).toContain('authority_reference');
    expect(authoritySql).toContain('authority_sha256');
    expect(authoritySql).not.toMatch(/document_base64|signature_image|private_key|password/i);
  });

  it('keeps structured verification as a sponsor-package hard dependency', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/server/lib/sponsorReadinessStore.ts'), 'utf8');
    expect(source).toContain("key: 'structured_legal_entity_registry'");
    expect(source).toContain("legalEntityState !== 'verified'");
    expect(source).toContain('const fullyReviewed = gaps.length === 0');
    const register = fs.readFileSync(path.join(process.cwd(), 'src/server/lib/legalEntityVerificationStore.ts'), 'utf8');
    expect(register).toContain('assertApprovedProvider');
    expect(register).toContain('APPROVED_ENTITY_REGISTRY_HOSTS');
    expect(register).toContain('appendCriticalAudit');
    expect(register).toContain('assertLegalEntityReviewOwnership');
  });
});
