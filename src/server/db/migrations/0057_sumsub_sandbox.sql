-- Sandbox records deliberately have no link to customer identity or approval tables.
CREATE TABLE sumsub_sandbox_applicants (
  external_user_id TEXT PRIMARY KEY CHECK (external_user_id ~ '^sbx_[a-f0-9]{32}$'),
  applicant_id TEXT UNIQUE CHECK (applicant_id ~ '^[a-f0-9]{24}$'),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (external_user_id, applicant_id)
);
CREATE TABLE sumsub_sandbox_events (
  payload_sha256 TEXT PRIMARY KEY CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  external_user_id TEXT NOT NULL,
  applicant_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'review', 'rejected')),
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (external_user_id, applicant_id) REFERENCES sumsub_sandbox_applicants(external_user_id, applicant_id) ON DELETE RESTRICT
);
CREATE INDEX sumsub_sandbox_events_applicant_time ON sumsub_sandbox_events(external_user_id, occurred_at DESC, received_at DESC);
ALTER TABLE sumsub_sandbox_applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE sumsub_sandbox_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sumsub_sandbox_applicants, sumsub_sandbox_events FROM PUBLIC;
CREATE TRIGGER sumsub_sandbox_events_immutable BEFORE UPDATE OR DELETE ON sumsub_sandbox_events
FOR EACH ROW EXECUTE FUNCTION reject_onboarding_provider_event_mutation();
