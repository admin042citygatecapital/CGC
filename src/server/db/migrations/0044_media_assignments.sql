-- Durable page-slot assignments and non-destructive crop settings for media assets.
CREATE TABLE IF NOT EXISTS media_asset_assignments (
  id TEXT PRIMARY KEY,
  media_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  page_key TEXT NOT NULL CHECK (page_key ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  slot_key TEXT NOT NULL CHECK (slot_key ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  crop_x INTEGER NOT NULL DEFAULT 50 CHECK (crop_x BETWEEN 0 AND 100),
  crop_y INTEGER NOT NULL DEFAULT 50 CHECK (crop_y BETWEEN 0 AND 100),
  crop_zoom NUMERIC(4,2) NOT NULL DEFAULT 1 CHECK (crop_zoom BETWEEN 1 AND 4),
  crop_aspect TEXT NOT NULL DEFAULT 'original' CHECK (crop_aspect IN ('original','square','portrait','landscape','wide')),
  assigned_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (page_key, slot_key)
);

CREATE INDEX IF NOT EXISTS media_asset_assignments_asset_idx ON media_asset_assignments(media_asset_id);
CREATE INDEX IF NOT EXISTS media_asset_assignments_page_idx ON media_asset_assignments(page_key, slot_key);
