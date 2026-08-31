import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('private KYC schema and browser boundary',()=>{
  const migration=readFileSync('src/server/db/migrations/0056_private_kyc_onboarding.sql','utf8');
  it('uses versioned server-only metadata with constraints and RLS',()=>{
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS kyc_profiles');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS kyc_documents');
    expect(migration).toContain('kyc_documents_active_kind_idx');
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE kyc_profiles, kyc_documents FROM PUBLIC');
    expect(migration).toContain('submission_idempotency_key');
  });
  it('never creates or mutates the Supabase bucket through SQL',()=>{
    expect(migration).not.toContain('storage.buckets');
    expect(migration).not.toContain('storage.objects');
  });
  it('never returns public or signed storage URLs',()=>{
    const storage=readFileSync('src/server/lib/kycStorage.ts','utf8');
    const customer=readFileSync('src/server/api/users/onboarding/GET.ts','utf8');
    const admin=readFileSync('src/server/api/admin/onboarding/GET.ts','utf8');
    expect(storage).not.toContain('getPublicUrl');
    expect(storage).not.toContain('createSignedUrl');
    expect(customer).not.toContain('storageKey');
    expect(admin).not.toContain('storageKey');
  });
});
