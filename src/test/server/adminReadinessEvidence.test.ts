import { describe, expect, it } from 'vitest';
import { adminHealthState, sessionRecentlyActive } from '../../lib/adminHealthPresentation.js';
import { databaseTarget, restoreEvidence } from '../../server/lib/databaseEvidence.js';
import { sumsubConfiguration } from '../../server/lib/onboardingProviderReadiness.js';

describe('admin evidence presentation', () => {
  it('uses the authoritative health status rather than incomplete legacy checks', () => {
    expect(adminHealthState({ status: 'warning', checks: { api: 'PASS' } })).toBe('warning');
    expect(adminHealthState({ status: 'degraded', checks: { api: 'PASS' } })).toBe('degraded');
    expect(adminHealthState({ checks: {} })).toBe('unknown');
    expect(adminHealthState(null)).toBe('unknown');
  });
  it('distinguishes recent activity from an unexpired session', () => {
    const now = Date.parse('2026-09-05T12:00:00Z');
    expect(sessionRecentlyActive('2026-09-05T11:30:00Z', now)).toBe(true);
    expect(sessionRecentlyActive('2026-09-01T11:30:00Z', now)).toBe(false);
    expect(sessionRecentlyActive('invalid', now)).toBe(false);
    expect(sessionRecentlyActive('2026-09-06T11:30:00Z', now)).toBe(false);
  });
  it('reports database lineage without credentials and detects mismatched projects', () => {
    const target = databaseTarget('postgresql://postgres.projectabc:secret@aws-0.pooler.supabase.com:6543/postgres', 'https://otherproject.supabase.co');
    expect(target).toMatchObject({ provider: 'Supabase', projectRef: 'projectabc', matchesStorageProject: false });
    expect(JSON.stringify(target)).not.toContain('secret');
    expect(databaseTarget('postgresql://user:secret@db.projectabc.supabase.co/postgres', 'https://projectabc.supabase.co').matchesStorageProject).toBe(true);
    expect(databaseTarget('postgresql://user:secret@ep-example.neon.tech/db', '').provider).toBe('Neon');
  });
  it('requires a recent past restore timestamp and evidence reference', () => {
    const now = Date.parse('2026-09-05T12:00:00Z');
    const env = { MANAGED_DATABASE_BACKUPS_CONFIRMED: '1', BACKUP_LAST_RESTORE_TEST_AT: '2026-09-04T10:00:00Z', BACKUP_RESTORE_EVIDENCE_ID: 'restore-report-001' };
    expect(restoreEvidence(env, now).complete).toBe(true);
    for (const date of ['anything', '2026-09-06T10:00:00Z', '2025-09-04T10:00:00Z']) expect(restoreEvidence({ ...env, BACKUP_LAST_RESTORE_TEST_AT: date }, now).complete).toBe(false);
    expect(restoreEvidence({ ...env, BACKUP_RESTORE_EVIDENCE_ID: '' }, now).complete).toBe(false);
  });
  it('does not equate existing webhook configuration with a working sandbox KYC flow', () => {
    const evidence = sumsubConfiguration({ APPROVED_ONBOARDING_PROVIDERS: 'sumsub', ONBOARDING_PROVIDER_WEBHOOK_SECRET_SUMSUB: 'x'.repeat(32) });
    expect(evidence).toMatchObject({ receiverReady: true, applicantCreationImplemented: false, scope: 'sandbox_kyc_only', amlInScope: false, liveFinancialActivityInScope: false });
    expect(sumsubConfiguration({}).receiverReady).toBe(false);
  });
});
