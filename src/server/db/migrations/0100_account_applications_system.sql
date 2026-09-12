-- 0018: Multi-account application system.
--
-- Extends the existing account_applications table (previously the flat
-- data-minimised intake) into the relational backbone of the per-account-type
-- application journeys, and adds an event table for the application audit
-- trail. Additive only — no data is dropped or rewritten; the legacy intake
-- API keeps working because every legacy column keeps its default.

-- Legacy-compat: the account_applications table originated out-of-band in the
-- production database. Guard its creation so fresh databases (CI, previews)
-- can run this migration; existing tables are untouched.
CREATE TABLE IF NOT EXISTS account_applications (
  id             TEXT PRIMARY KEY,
  first_name     TEXT NOT NULL DEFAULT '',
  last_name      TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL,
  phone          TEXT NOT NULL DEFAULT '',
  dob            TEXT NOT NULL DEFAULT '',
  gender         TEXT,
  nationality    TEXT NOT NULL DEFAULT '',
  address        TEXT NOT NULL DEFAULT '',
  account_type   TEXT NOT NULL DEFAULT 'personal',
  status         TEXT NOT NULL DEFAULT 'APPLICATION_STARTED',
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip             TEXT NOT NULL DEFAULT 'unknown',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE account_applications
  ADD COLUMN IF NOT EXISTS reference           TEXT,
  ADD COLUMN IF NOT EXISTS user_id             TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selected_plan       TEXT,
  ADD COLUMN IF NOT EXISTS current_step        TEXT NOT NULL DEFAULT 'contact',
  ADD COLUMN IF NOT EXISTS completion_pct      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS steps               JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS email_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS decision            TEXT,
  ADD COLUMN IF NOT EXISTS decision_reason     TEXT,
  ADD COLUMN IF NOT EXISTS decided_by          TEXT,
  ADD COLUMN IF NOT EXISTS decided_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS information_request TEXT,
  ADD COLUMN IF NOT EXISTS created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS account_applications_reference_idx
  ON account_applications (reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS account_applications_user_idx      ON account_applications (user_id);
CREATE INDEX IF NOT EXISTS account_applications_status_idx    ON account_applications (status);
CREATE INDEX IF NOT EXISTS account_applications_type_idx      ON account_applications (account_type);

-- Application audit trail: every state transition and admin action.
CREATE TABLE IF NOT EXISTS application_events (
  id             TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES account_applications(id) ON DELETE CASCADE,
  actor          TEXT NOT NULL,
  actor_role     TEXT,
  event          TEXT NOT NULL,
  detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS application_events_application_idx ON application_events (application_id, created_at);