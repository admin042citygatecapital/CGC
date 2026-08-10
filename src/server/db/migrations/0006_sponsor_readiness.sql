-- Database-backed UK sponsor-readiness control plane.
-- Only evidence metadata is stored; sensitive source documents stay outside.

DO $$ BEGIN
  CREATE TYPE sponsor_evidence_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sponsor_package_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS sponsor_packages (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  legal_entity_state TEXT NOT NULL DEFAULT 'unverified',
  status sponsor_package_status NOT NULL DEFAULT 'draft',
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sponsor_packages_legal_entity_state_check CHECK (legal_entity_state = 'unverified')
);

CREATE TABLE IF NOT EXISTS sponsor_evidence (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES sponsor_packages(id),
  control_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status sponsor_evidence_status NOT NULL DEFAULT 'draft',
  reference_type TEXT NOT NULL,
  reference TEXT NOT NULL,
  sha256 TEXT,
  owner TEXT NOT NULL,
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_by TEXT NOT NULL,
  last_edited_by TEXT NOT NULL,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sponsor_evidence_reference_type_check CHECK (reference_type IN ('url', 'internal')),
  CONSTRAINT sponsor_evidence_sha256_check CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT sponsor_evidence_dates_check CHECK (expires_at IS NULL OR issued_at IS NULL OR expires_at > issued_at)
);

CREATE INDEX IF NOT EXISTS sponsor_evidence_package_control_idx ON sponsor_evidence (package_id, control_key);
CREATE INDEX IF NOT EXISTS sponsor_evidence_status_idx ON sponsor_evidence (status);
CREATE INDEX IF NOT EXISTS sponsor_evidence_expiry_idx ON sponsor_evidence (expires_at);

CREATE TABLE IF NOT EXISTS sponsor_evidence_events (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES sponsor_packages(id),
  evidence_id TEXT REFERENCES sponsor_evidence(id),
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role admin_role NOT NULL,
  from_status TEXT,
  to_status TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sponsor_evidence_events_evidence_idx ON sponsor_evidence_events (evidence_id, created_at);
CREATE INDEX IF NOT EXISTS sponsor_evidence_events_package_idx ON sponsor_evidence_events (package_id, created_at);

INSERT INTO sponsor_packages (id, version, jurisdiction, legal_entity_state)
VALUES ('uk-multicurrency-v1', '1.0', 'United Kingdom', 'unverified')
ON CONFLICT (id) DO NOTHING;

-- Database-level append-only protection for immutable review history.
CREATE OR REPLACE FUNCTION prevent_sponsor_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'sponsor_evidence_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sponsor_events_no_update ON sponsor_evidence_events;
CREATE TRIGGER sponsor_events_no_update BEFORE UPDATE OR DELETE ON sponsor_evidence_events
FOR EACH ROW EXECUTE FUNCTION prevent_sponsor_event_mutation();
