-- Database-backed customer onboarding control plane. Evidence is metadata-only:
-- original identity documents and provider credentials must not be stored here.
CREATE TABLE IF NOT EXISTS onboarding_cases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_type TEXT NOT NULL CHECK (case_type IN ('individual', 'business')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'needs_info', 'approved', 'rejected', 'expired')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  assigned_to TEXT,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  last_edited_by TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_cases_open_user_idx
  ON onboarding_cases(user_id) WHERE status NOT IN ('rejected', 'expired');
CREATE INDEX IF NOT EXISTS onboarding_cases_status_updated_idx ON onboarding_cases(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS onboarding_evidence (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES onboarding_cases(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('identity', 'address', 'selfie', 'company', 'ownership', 'authority', 'screening')),
  reference_type TEXT NOT NULL CHECK (reference_type IN ('provider', 'controlled_url', 'internal')),
  reference TEXT NOT NULL,
  sha256 TEXT,
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  last_edited_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT onboarding_evidence_sha256_check CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS onboarding_evidence_case_idx ON onboarding_evidence(case_id, created_at);

CREATE TABLE IF NOT EXISTS onboarding_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES onboarding_cases(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('customer', 'admin', 'system')),
  from_status TEXT,
  to_status TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS onboarding_events_case_created_idx ON onboarding_events(case_id, created_at);
CREATE INDEX IF NOT EXISTS onboarding_events_user_created_idx ON onboarding_events(user_id, created_at);

-- Prevent mutation or deletion of the immutable lifecycle history at the DB layer.
CREATE OR REPLACE FUNCTION reject_onboarding_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'lifecycle event tables are append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS onboarding_events_immutable_update ON onboarding_events;
CREATE TRIGGER onboarding_events_immutable_update BEFORE UPDATE OR DELETE ON onboarding_events
FOR EACH ROW EXECUTE FUNCTION reject_onboarding_event_mutation();

CREATE TABLE IF NOT EXISTS compliance_cases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('aml', 'sanctions')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'escalated', 'cleared', 'blocked')),
  risk_level TEXT NOT NULL DEFAULT 'unrated' CHECK (risk_level IN ('unrated', 'low', 'medium', 'high')),
  summary TEXT NOT NULL,
  assigned_to TEXT,
  opened_by TEXT NOT NULL,
  last_edited_by TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS compliance_cases_status_updated_idx ON compliance_cases(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS compliance_cases_user_idx ON compliance_cases(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS compliance_case_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES compliance_cases(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS compliance_case_events_case_idx ON compliance_case_events(case_id, created_at);
DROP TRIGGER IF EXISTS compliance_case_events_immutable_update ON compliance_case_events;
CREATE TRIGGER compliance_case_events_immutable_update BEFORE UPDATE OR DELETE ON compliance_case_events
FOR EACH ROW EXECUTE FUNCTION reject_onboarding_event_mutation();
