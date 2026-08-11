-- Append-only signed webhook ledger for approved identity/KYB and screening
-- providers. Raw webhook bodies and identity documents are never stored.
CREATE TABLE IF NOT EXISTS onboarding_provider_events (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  provider_code TEXT NOT NULL CHECK (provider_code ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  case_id TEXT NOT NULL REFERENCES onboarding_cases(id) ON DELETE RESTRICT,
  provider_ref TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('identity', 'kyb', 'screening')),
  status TEXT NOT NULL CHECK (status IN ('accepted', 'review', 'rejected')),
  screening JSONB,
  payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS onboarding_provider_events_case_idx ON onboarding_provider_events(case_id, received_at DESC);
CREATE INDEX IF NOT EXISTS onboarding_provider_events_provider_ref_idx ON onboarding_provider_events(provider_code, provider_ref);

CREATE OR REPLACE FUNCTION reject_onboarding_provider_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'onboarding_provider_events is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS onboarding_provider_events_immutable ON onboarding_provider_events;
CREATE TRIGGER onboarding_provider_events_immutable BEFORE UPDATE OR DELETE ON onboarding_provider_events
FOR EACH ROW EXECUTE FUNCTION reject_onboarding_provider_event_mutation();
