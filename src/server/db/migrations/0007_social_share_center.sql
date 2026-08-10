-- Durable profile links and administrator share-intent activity.
-- No social-provider credentials or OAuth tokens are stored in these tables.

CREATE TABLE IF NOT EXISTS social_profiles (
  platform_id TEXT PRIMARY KEY,
  url TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  show_in_footer BOOLEAN NOT NULL DEFAULT TRUE,
  show_in_contact BOOLEAN NOT NULL DEFAULT TRUE,
  show_in_dashboard BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_share_events (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  target_url TEXT NOT NULL,
  platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  opened_platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'opened')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_share_events_created_idx
  ON social_share_events (created_at DESC);
CREATE INDEX IF NOT EXISTS social_share_events_status_idx
  ON social_share_events (status);
