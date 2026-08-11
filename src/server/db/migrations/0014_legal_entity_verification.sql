-- Structured legal-entity and beneficial-ownership verification metadata.
-- No identity documents, dates of birth, residential addresses or secrets.
CREATE TABLE IF NOT EXISTS legal_entity_profiles (
  id TEXT PRIMARY KEY, package_id TEXT NOT NULL UNIQUE, version INTEGER NOT NULL DEFAULT 1,
  legal_name TEXT NOT NULL, jurisdiction TEXT NOT NULL, registration_number TEXT NOT NULL,
  legal_form TEXT NOT NULL, registry_url TEXT NOT NULL, registry_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','verified','rejected','expired')),
  created_by TEXT NOT NULL, last_edited_by TEXT NOT NULL, submitted_by TEXT, submitted_at TIMESTAMPTZ,
  reviewed_by TEXT, reviewed_at TIMESTAMPTZ, review_note TEXT, expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (registry_url ~ '^https://'), CHECK (registry_sha256 IS NULL OR registry_sha256 ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS legal_entity_profiles_status_idx ON legal_entity_profiles(status);

CREATE TABLE IF NOT EXISTS beneficial_owner_records (
  id TEXT PRIMARY KEY, entity_id TEXT NOT NULL REFERENCES legal_entity_profiles(id) ON DELETE RESTRICT,
  controller_ref TEXT NOT NULL, ownership_band TEXT NOT NULL CHECK (ownership_band IN ('none','0-25','25-50','50-75','75-100')),
  control_nature TEXT NOT NULL, provider_code TEXT NOT NULL, provider_ref TEXT NOT NULL, evidence_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','verified','rejected','expired')), active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL, last_edited_by TEXT NOT NULL, submitted_by TEXT, submitted_at TIMESTAMPTZ,
  reviewed_by TEXT, reviewed_at TIMESTAMPTZ, review_note TEXT, expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_id, controller_ref), CHECK (evidence_sha256 IS NULL OR evidence_sha256 ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS beneficial_owner_status_idx ON beneficial_owner_records(status, active);

CREATE TABLE IF NOT EXISTS legal_entity_verification_events (
  id TEXT PRIMARY KEY, entity_id TEXT NOT NULL REFERENCES legal_entity_profiles(id) ON DELETE RESTRICT,
  owner_record_id TEXT REFERENCES beneficial_owner_records(id) ON DELETE RESTRICT, action TEXT NOT NULL,
  actor_id TEXT NOT NULL, actor_role admin_role NOT NULL, from_status TEXT, to_status TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS legal_entity_events_entity_idx ON legal_entity_verification_events(entity_id, created_at);
CREATE INDEX IF NOT EXISTS legal_entity_events_owner_idx ON legal_entity_verification_events(owner_record_id, created_at);

CREATE OR REPLACE FUNCTION reject_legal_entity_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'legal entity verification events are immutable'; END; $$;
DROP TRIGGER IF EXISTS legal_entity_verification_events_immutable ON legal_entity_verification_events;
CREATE TRIGGER legal_entity_verification_events_immutable BEFORE UPDATE OR DELETE ON legal_entity_verification_events
FOR EACH ROW EXECUTE FUNCTION reject_legal_entity_event_mutation();
