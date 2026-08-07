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
