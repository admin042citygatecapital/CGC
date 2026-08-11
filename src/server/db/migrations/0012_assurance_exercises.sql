CREATE TABLE IF NOT EXISTS assurance_exercises (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('penetration_test','disaster_recovery','compliance_acceptance')),
  title TEXT NOT NULL, scope TEXT NOT NULL, owner TEXT NOT NULL, provider TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','submitted','accepted','rejected')),
  outcome TEXT NOT NULL DEFAULT 'not_run' CHECK (outcome IN ('not_run','passed','passed_with_findings','failed')),
  evidence_url TEXT, evidence_sha256 TEXT, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, expires_at TIMESTAMPTZ,
  critical_findings INTEGER NOT NULL DEFAULT 0 CHECK (critical_findings >= 0),
  high_findings INTEGER NOT NULL DEFAULT 0 CHECK (high_findings >= 0),
  open_findings INTEGER NOT NULL DEFAULT 0 CHECK (open_findings >= 0),
  notes TEXT, created_by TEXT NOT NULL, last_edited_by TEXT NOT NULL,
  submitted_by TEXT, submitted_at TIMESTAMPTZ, reviewed_by TEXT, reviewed_at TIMESTAMPTZ, review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS assurance_exercises_kind_status_idx ON assurance_exercises(kind, status);
CREATE INDEX IF NOT EXISTS assurance_exercises_expiry_idx ON assurance_exercises(expires_at);

CREATE TABLE IF NOT EXISTS assurance_exercise_events (
  id TEXT PRIMARY KEY, exercise_id TEXT NOT NULL REFERENCES assurance_exercises(id) ON DELETE RESTRICT,
  action TEXT NOT NULL, actor_id TEXT NOT NULL, actor_role admin_role NOT NULL,
  from_status TEXT, to_status TEXT, details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS assurance_exercise_events_exercise_idx ON assurance_exercise_events(exercise_id, created_at);
CREATE OR REPLACE FUNCTION reject_assurance_event_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'assurance_exercise_events is append-only'; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS assurance_exercise_events_immutable ON assurance_exercise_events;
CREATE TRIGGER assurance_exercise_events_immutable BEFORE UPDATE OR DELETE ON assurance_exercise_events
FOR EACH ROW EXECUTE FUNCTION reject_assurance_event_mutation();
