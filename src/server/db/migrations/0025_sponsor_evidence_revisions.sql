-- Bind sponsor-evidence review decisions to immutable metadata revisions.
-- Source documents and credentials remain outside this database.

ALTER TABLE sponsor_evidence ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sponsor_evidence ADD COLUMN IF NOT EXISTS submitted_revision INTEGER;
ALTER TABLE sponsor_evidence ADD COLUMN IF NOT EXISTS reviewed_revision INTEGER;

UPDATE sponsor_evidence
SET submitted_revision = revision
WHERE status IN ('submitted', 'approved', 'rejected') AND submitted_revision IS NULL;

UPDATE sponsor_evidence
SET reviewed_revision = revision
WHERE status IN ('approved', 'rejected') AND reviewed_revision IS NULL;

ALTER TABLE sponsor_evidence DROP CONSTRAINT IF EXISTS sponsor_evidence_revision_positive_check;
ALTER TABLE sponsor_evidence ADD CONSTRAINT sponsor_evidence_revision_positive_check
  CHECK (revision >= 1);

ALTER TABLE sponsor_evidence DROP CONSTRAINT IF EXISTS sponsor_evidence_revision_binding_check;
ALTER TABLE sponsor_evidence ADD CONSTRAINT sponsor_evidence_revision_binding_check CHECK (
  (submitted_revision IS NULL OR (submitted_revision >= 1 AND submitted_revision <= revision)) AND
  (reviewed_revision IS NULL OR (reviewed_revision >= 1 AND reviewed_revision <= revision)) AND
  (status <> 'draft' OR (submitted_revision IS NULL AND reviewed_revision IS NULL)) AND
  (status <> 'submitted' OR (submitted_revision = revision AND reviewed_revision IS NULL)) AND
  (status NOT IN ('approved', 'rejected') OR (submitted_revision = revision AND reviewed_revision = revision))
);

CREATE TABLE IF NOT EXISTS sponsor_evidence_revisions (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES sponsor_packages(id),
  evidence_id TEXT NOT NULL REFERENCES sponsor_evidence(id),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  control_key TEXT NOT NULL,
  title TEXT NOT NULL,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('url', 'internal')),
  reference TEXT NOT NULL,
  sha256 TEXT CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
  owner TEXT NOT NULL,
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  actor_id TEXT NOT NULL,
  actor_role admin_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sponsor_evidence_revision_dates_check CHECK (expires_at IS NULL OR issued_at IS NULL OR expires_at > issued_at),
  CONSTRAINT sponsor_evidence_revisions_evidence_revision_unique UNIQUE (evidence_id, revision)
);

CREATE INDEX IF NOT EXISTS sponsor_evidence_revisions_package_idx
  ON sponsor_evidence_revisions (package_id, created_at);

-- Preserve a baseline for records that pre-date revision tracking. Historical
-- lifecycle events remain authoritative for activity before this migration.
INSERT INTO sponsor_evidence_revisions
  (id, package_id, evidence_id, revision, control_key, title, reference_type,
   reference, sha256, owner, issued_at, expires_at, notes, actor_id, actor_role, created_at)
SELECT
  'ser_' || md5(e.id || ':1'), e.package_id, e.id, e.revision, e.control_key,
  e.title, e.reference_type, e.reference, e.sha256, e.owner, e.issued_at,
  e.expires_at, e.notes, e.last_edited_by,
  COALESCE((
    SELECT ev.actor_role FROM sponsor_evidence_events ev
    WHERE ev.evidence_id = e.id AND ev.action IN ('created', 'edited')
    ORDER BY ev.created_at DESC LIMIT 1
  ), 'SUPER_ADMIN'::admin_role),
  e.updated_at
FROM sponsor_evidence e
ON CONFLICT (evidence_id, revision) DO NOTHING;

CREATE OR REPLACE FUNCTION prevent_sponsor_evidence_revision_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'sponsor_evidence_revisions is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sponsor_evidence_revisions_no_mutation ON sponsor_evidence_revisions;
CREATE TRIGGER sponsor_evidence_revisions_no_mutation
BEFORE UPDATE OR DELETE ON sponsor_evidence_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_sponsor_evidence_revision_mutation();
