-- Durable metadata for public brand and website assets. Binary objects are
-- stored in Supabase Storage; credentials and private customer documents are
-- intentionally excluded from this library.
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video','pdf','document')),
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  public_url TEXT NOT NULL,
  storage_key TEXT,
  alt_text TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tags) = 'array'),
  folder TEXT NOT NULL DEFAULT 'uncategorized',
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  optimized BOOLEAN NOT NULL DEFAULT FALSE,
  optimized_size_bytes BIGINT CHECK (optimized_size_bytes IS NULL OR optimized_size_bytes > 0),
  replaced_by_id TEXT,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS media_assets_created_idx ON media_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS media_assets_type_idx ON media_assets(media_type);
CREATE INDEX IF NOT EXISTS media_assets_folder_idx ON media_assets(folder);
