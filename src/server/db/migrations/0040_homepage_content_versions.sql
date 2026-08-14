-- Versioned public homepage publications. Every row retains the full content,
-- SHA-256 fingerprint, actor, reason, and publication time.
CREATE TABLE IF NOT EXISTS homepage_content_versions (
  version INTEGER PRIMARY KEY CHECK (version > 0),
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  updated_by TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 300),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS homepage_content_versions_hash_idx
  ON homepage_content_versions(content_hash);
CREATE INDEX IF NOT EXISTS homepage_content_versions_updated_idx
  ON homepage_content_versions(updated_at DESC);

-- Published versions are append-only. Corrections create a new version rather
-- than altering the evidence trail of a previous publication.
CREATE OR REPLACE FUNCTION prevent_homepage_content_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'homepage content versions are immutable';
END;
$$;

DROP TRIGGER IF EXISTS homepage_content_versions_immutable
  ON homepage_content_versions;
CREATE TRIGGER homepage_content_versions_immutable
  BEFORE UPDATE OR DELETE ON homepage_content_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_homepage_content_version_mutation();
