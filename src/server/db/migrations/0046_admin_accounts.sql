-- Canonical database-backed administrator identities.
--
-- The application schema has referenced this table since database-backed
-- admin authentication was introduced, but the SQL migration was missing.
-- This additive migration does not seed credentials, alter customer data, or
-- copy any environment secret into PostgreSQL.

CREATE TABLE IF NOT EXISTS admins (
  id                   TEXT PRIMARY KEY,
  email                TEXT NOT NULL,
  password_hash        TEXT NOT NULL,
  name                 TEXT NOT NULL,
  role                 admin_role NOT NULL,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS admins_email_idx ON admins (LOWER(email));
CREATE INDEX IF NOT EXISTS admins_role_idx ON admins (role);
CREATE INDEX IF NOT EXISTS admins_active_idx ON admins (is_active);
