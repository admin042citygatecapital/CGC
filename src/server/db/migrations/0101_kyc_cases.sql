-- 0019: Per-application KYC cases.
--
-- Links each account application to its own KYC review case. Complements the
-- existing per-user KYC data (kyc_profiles / kyc_documents) — it does not
-- duplicate them. Liveness/provider fields store only provider-reported
-- status and references; results are never fabricated client-side.

CREATE TABLE IF NOT EXISTS kyc_cases (
  id              TEXT PRIMARY KEY,
  application_id  TEXT NOT NULL REFERENCES account_applications(id) ON DELETE CASCADE,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  account_type    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'DRAFT',
  risk_level      TEXT NOT NULL DEFAULT 'unrated',
  reviewer_id     TEXT,
  provider_name   TEXT,
  provider_status TEXT,
  provider_ref    TEXT,
  submitted_at    TIMESTAMPTZ,
  reviewed_at     TIMESTAMPTZ,
  review_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS kyc_cases_application_idx ON kyc_cases (application_id);
CREATE INDEX IF NOT EXISTS kyc_cases_status_idx      ON kyc_cases (status);
CREATE INDEX IF NOT EXISTS kyc_cases_user_idx        ON kyc_cases (user_id);

CREATE TABLE IF NOT EXISTS kyc_case_events (
  id            TEXT PRIMARY KEY,
  case_id       TEXT NOT NULL REFERENCES kyc_cases(id) ON DELETE CASCADE,
  actor         TEXT NOT NULL,
  actor_role    TEXT,
  event         TEXT NOT NULL,
  detail        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kyc_case_events_case_idx ON kyc_case_events (case_id, created_at);

-- Registered KYC documents for a case (metadata only; bytes live in the
-- private Supabase bucket, referenced by storage path, never public).
CREATE TABLE IF NOT EXISTS kyc_case_documents (
  id             TEXT PRIMARY KEY,
  case_id        TEXT NOT NULL REFERENCES kyc_cases(id) ON DELETE CASCADE,
  document_type  TEXT NOT NULL,
  issuing_country TEXT,
  storage_path   TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  byte_size      INTEGER NOT NULL,
  original_name  TEXT,
  uploaded_by    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kyc_case_documents_case_idx ON kyc_case_documents (case_id);