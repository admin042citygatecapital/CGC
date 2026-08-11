-- Database-backed complaints and error-resolution workflow. Time targets are
-- internal operational targets until sponsor/counsel evidence approves them.
CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_phone TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('transaction','account','card','kyc','staff','technical','other')),
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','escalated','resolved','closed')),
  assigned_to TEXT,
  resolution TEXT,
  internal_notes TEXT NOT NULL DEFAULT '',
  regulatory_flag BOOLEAN NOT NULL DEFAULT FALSE,
  response_due_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  last_edited_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS complaints_status_due_idx ON complaints(status, response_due_at);
CREATE INDEX IF NOT EXISTS complaints_severity_created_idx ON complaints(severity, created_at DESC);

CREATE TABLE IF NOT EXISTS complaint_events (
  id TEXT PRIMARY KEY,
  complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS complaint_events_complaint_idx ON complaint_events(complaint_id, created_at);
CREATE OR REPLACE FUNCTION reject_complaint_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'complaint_events is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS complaint_events_immutable ON complaint_events;
CREATE TRIGGER complaint_events_immutable BEFORE UPDATE OR DELETE ON complaint_events
FOR EACH ROW EXECUTE FUNCTION reject_complaint_event_mutation();
