-- Synthetic sponsor-provider sandbox. No real customer identifiers, funds,
-- credentials or live provider records may enter these tables.
ALTER TABLE sponsor_packages DROP CONSTRAINT IF EXISTS sponsor_packages_legal_entity_state_check;
ALTER TABLE sponsor_packages ADD CONSTRAINT sponsor_packages_legal_entity_state_check
  CHECK (legal_entity_state IN ('unverified', 'evidence_pending', 'verified'));

CREATE TABLE IF NOT EXISTS provider_sandbox_runs (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('individual', 'business')),
  subject_ref TEXT NOT NULL CHECK (subject_ref ~ '^syn_[a-z0-9][a-z0-9_-]{2,80}$'),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'passed', 'failed')),
  currencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_code TEXT,
  initiated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS provider_sandbox_runs_created_idx ON provider_sandbox_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS provider_sandbox_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES provider_sandbox_runs(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  event_type TEXT NOT NULL,
  provider_ref TEXT CHECK (provider_ref IS NULL OR provider_ref ~ '^syn_[a-z0-9][a-z0-9_-]{2,80}$'),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(run_id, sequence)
);
CREATE INDEX IF NOT EXISTS provider_sandbox_events_run_idx ON provider_sandbox_events(run_id, sequence);

CREATE OR REPLACE FUNCTION reject_provider_sandbox_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'provider_sandbox_events is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS provider_sandbox_events_immutable ON provider_sandbox_events;
CREATE TRIGGER provider_sandbox_events_immutable BEFORE UPDATE OR DELETE ON provider_sandbox_events
FOR EACH ROW EXECUTE FUNCTION reject_provider_sandbox_event_mutation();
