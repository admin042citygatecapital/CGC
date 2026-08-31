-- Private, versioned KYC profile and document metadata. Raw document bytes live
-- in a private Supabase Storage bucket and are never exposed through PostgREST.

CREATE TABLE IF NOT EXISTS kyc_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL UNIQUE REFERENCES onboarding_cases(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  nationality TEXT NOT NULL,
  residence_country TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  region TEXT,
  postal_code TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('passport', 'national_id', 'drivers_license', 'residence_permit')),
  issuing_country TEXT NOT NULL,
  document_number_ciphertext TEXT NOT NULL,
  document_number_last4 TEXT NOT NULL CHECK (document_number_last4 ~ '^[A-Za-z0-9]{1,4}$'),
  document_issued_at DATE,
  document_expires_at DATE NOT NULL,
  information_certified BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_documents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES onboarding_cases(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('identity_front', 'identity_back', 'proof_of_address', 'additional')),
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 5242880),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'superseded', 'rejected')),
  retention_classification TEXT NOT NULL DEFAULT 'regulated_identity_evidence_pending_policy',
  version INTEGER NOT NULL CHECK (version > 0),
  original_name TEXT NOT NULL,
  superseded_at TIMESTAMPTZ,
  superseded_by TEXT REFERENCES kyc_documents(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT kyc_documents_superseded_state CHECK (
    (state = 'superseded' AND superseded_at IS NOT NULL AND superseded_by IS NOT NULL)
    OR (state <> 'superseded' AND superseded_at IS NULL AND superseded_by IS NULL)
  )
);

ALTER TABLE onboarding_cases
  ADD COLUMN IF NOT EXISTS requested_evidence_kinds JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_instructions TEXT,
  ADD COLUMN IF NOT EXISTS submission_idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS kyc_profiles_case_id_idx ON kyc_profiles(case_id);
CREATE INDEX IF NOT EXISTS kyc_documents_case_created_idx ON kyc_documents(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS kyc_documents_user_created_idx ON kyc_documents(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS kyc_documents_active_kind_idx
  ON kyc_documents(case_id, kind) WHERE state = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_cases_submission_idempotency_idx
  ON onboarding_cases(submission_idempotency_key)
  WHERE submission_idempotency_key IS NOT NULL;

ALTER TABLE kyc_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE kyc_profiles, kyc_documents FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE kyc_profiles, kyc_documents FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE kyc_profiles, kyc_documents FROM authenticated;
  END IF;
END $$;

COMMENT ON TABLE kyc_profiles IS 'Server-only KYC identity and residency profile. Document numbers are application encrypted.';
COMMENT ON TABLE kyc_documents IS 'Server-only metadata for immutable versions stored in a private Supabase Storage bucket.';
COMMENT ON COLUMN kyc_documents.storage_key IS 'Opaque server-only object key; never return through browser APIs.';
COMMENT ON COLUMN kyc_documents.retention_classification IS 'Evidence is retained until an approved policy authorizes disposition; ordinary administrators cannot delete it.';
