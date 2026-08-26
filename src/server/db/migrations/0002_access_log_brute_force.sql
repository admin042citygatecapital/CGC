-- Migration 0002: access_log + brute_force_lockouts tables
-- Run with: npx tsx src/server/db/applySchema2.ts

-- ── access_log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_log (
  id           TEXT        PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method       TEXT        NOT NULL,
  url          TEXT        NOT NULL,
  status       INTEGER     NOT NULL,
  duration     INTEGER     NOT NULL DEFAULT 0,
  ip           TEXT        NOT NULL,
  ua           TEXT        NOT NULL DEFAULT '',
  referer      TEXT        NOT NULL DEFAULT '',
  bytes        INTEGER     NOT NULL DEFAULT 0,
  user_id      TEXT,
  threat       TEXT        NOT NULL DEFAULT 'none',
  threat_note  TEXT        NOT NULL DEFAULT ''
);

-- Older Supabase environments already have access_log with the legacy
-- created_at/duration_ms/user_agent column names. Migration 0000 may already
-- be recorded in those databases, so reconcile the pending table migration
-- itself before creating canonical indexes. This is additive and preserves all
-- existing rows.
ALTER TABLE access_log
  ADD COLUMN IF NOT EXISTS ts TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ua TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'access_log' AND column_name = 'created_at'
  ) THEN
    UPDATE public.access_log SET ts = created_at
    WHERE ts IS NULL AND created_at IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'access_log' AND column_name = 'duration_ms'
  ) THEN
    UPDATE public.access_log SET duration = duration_ms
    WHERE duration_ms IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'access_log' AND column_name = 'user_agent'
  ) THEN
    UPDATE public.access_log SET ua = user_agent
    WHERE user_agent IS NOT NULL AND ua = '';
  END IF;
END $$;

UPDATE access_log SET ts = NOW() WHERE ts IS NULL;
ALTER TABLE access_log ALTER COLUMN ts SET DEFAULT NOW();
ALTER TABLE access_log ALTER COLUMN ts SET NOT NULL;

CREATE INDEX IF NOT EXISTS access_log_ts_idx     ON access_log (ts);
CREATE INDEX IF NOT EXISTS access_log_ip_idx     ON access_log (ip);
CREATE INDEX IF NOT EXISTS access_log_threat_idx ON access_log (threat);

-- ── brute_force_lockouts ──────────────────────────────────────────────────────
-- Note: brute force state is stored as JSON in the config table under key
-- 'brute_force'. This table is reserved for future row-level storage.
CREATE TABLE IF NOT EXISTS brute_force_lockouts (
  key          TEXT        PRIMARY KEY,
  count        INTEGER     NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_fail_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
