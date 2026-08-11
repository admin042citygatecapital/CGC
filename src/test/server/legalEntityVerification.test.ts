import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { allowedRolesForAdminRequest } from '../../server/lib/adminAuthorizationMiddleware.js';
import { assessLegalEntityVerification, assertLegalEntityMakerChecker } from '../../server/lib/legalEntityVerificationStore.js';
import { deriveStructuredLegalEntityState } from '../../server/lib/sponsorReadinessStore.js';

describe('legal entity and beneficial ownership verification', () => {
  const now = new Date('2026-08-11T00:00:00.000Z');
  const future = new Date('2027-08-11T00:00:00.000Z');
  const entity = { status: 'verified', expiresAt: future } as any;
  const owner = { active: true, status: 'verified', expiresAt: future } as any;

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
  });

  it('keeps structured verification as a sponsor-package hard dependency', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/server/lib/sponsorReadinessStore.ts'), 'utf8');
    expect(source).toContain("key: 'structured_legal_entity_registry'");
    expect(source).toContain("legalEntityState !== 'verified'");
    expect(source).toContain('const fullyReviewed = gaps.length === 0');
    const register = fs.readFileSync(path.join(process.cwd(), 'src/server/lib/legalEntityVerificationStore.ts'), 'utf8');
    expect(register).toContain('assertApprovedProvider');
    expect(register).toContain('APPROVED_ENTITY_REGISTRY_HOSTS');
  });
});
