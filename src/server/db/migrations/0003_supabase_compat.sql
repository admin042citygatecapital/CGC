-- ============================================================================
-- City Gate Capital — Migration 0003: Supabase-compatible additions
-- Migration: 0003_supabase_compat
--
-- Safe to run against Neon (existing) or Supabase Postgres (new).
-- All statements use IF NOT EXISTS / DO $$ guards — idempotent.
--
-- Changes:
--   1. Add storage_key column to media_records (if table exists)
--      Stores the Supabase Storage object key (e.g. "media/filename.jpg")
--      so delete operations can target the correct object.
--
--   2. Ensure schema_migrations tracking table exists
--      (migrate.ts creates this, but guard here for direct psql runs)
--
--   3. Add brute_force_lockouts.updated_at column (missing from 0002)
--
-- Run with:
--   npx tsx src/server/db/migrate.ts
-- Or directly:
--   psql "$DATABASE_URL" -f src/server/db/migrations/0003_supabase_compat.sql
-- ============================================================================

-- ── schema_migrations (idempotent guard) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT        PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── media_records.storage_key ─────────────────────────────────────────────────
-- Only add the column if the table exists (it may not — media is flat-file backed).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'media_records'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'media_records'
        AND column_name  = 'storage_key'
    ) THEN
      ALTER TABLE media_records ADD COLUMN storage_key TEXT;
      COMMENT ON COLUMN media_records.storage_key IS
        'Supabase Storage object key (e.g. media/filename.jpg). NULL = local filesystem.';
    END IF;
  END IF;
END $$;

-- ── brute_force_lockouts.updated_at ──────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'brute_force_lockouts'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'brute_force_lockouts'
        AND column_name  = 'updated_at'
    ) THEN
      ALTER TABLE brute_force_lockouts
        ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
  END IF;
END $$;

-- ── Indexes for performance on Supabase ───────────────────────────────────────
-- These are safe to run even if the indexes already exist.
CREATE INDEX IF NOT EXISTS users_email_idx         ON users (email);
CREATE INDEX IF NOT EXISTS users_status_idx        ON users (status);
CREATE INDEX IF NOT EXISTS transactions_user_idx   ON transactions (user_id);
CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions (status);
CREATE INDEX IF NOT EXISTS login_events_email_idx  ON login_events (email);
CREATE INDEX IF NOT EXISTS login_events_ts_idx     ON login_events (ts);
CREATE INDEX IF NOT EXISTS audit_log_ts_idx        ON audit_log (ts);
CREATE INDEX IF NOT EXISTS email_queue_status_idx  ON email_queue (status);
