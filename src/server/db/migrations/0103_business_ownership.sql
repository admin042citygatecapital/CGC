-- 0103: Relational persistence for business ownership, control and team access.
--
-- Collected through the BUSINESS wizard steps (business / ownership / personal
-- representative) and persisted relationally at submission so administrators
-- can query per-member and per-owner rows instead of parsing step JSON.
-- The wizard step JSON remains the collection format; these tables are the
-- queryable projection and are rewritten idempotently on every submission.
--
-- Mirrors the 0102 hardening pattern: RLS enabled, no permissive policies,
-- public Data-API roles revoked.

CREATE TABLE IF NOT EXISTS business_profiles (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  trading_name TEXT,
  entity_type TEXT,
  incorporation_country TEXT,
  registration_number TEXT,
  registered_address TEXT,
  operating_address TEXT,
  website TEXT,
  industry TEXT,
  description TEXT,
  monthly_activity TEXT,
  transaction_volume TEXT,
  required_currencies TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS business_profiles_application_idx ON business_profiles(application_id);

CREATE TABLE IF NOT EXISTS business_members (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  member_kind TEXT NOT NULL,            -- 'representative' | 'director' | 'team'
  team_role TEXT,                       -- Owner | Administrator | Finance | Approver | Viewer
  full_name TEXT NOT NULL,
  detail TEXT,                          -- role/title, ownership notes, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS business_members_application_idx ON business_members(application_id);

CREATE TABLE IF NOT EXISTS beneficial_owners (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  ownership_pct INTEGER NOT NULL CHECK (ownership_pct >= 0 AND ownership_pct <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS beneficial_owners_application_idx ON beneficial_owners(application_id);

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficial_owners ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE business_profiles, business_members, beneficial_owners FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE business_profiles, business_members, beneficial_owners FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE business_profiles, business_members, beneficial_owners FROM authenticated;
  END IF;
END $$;

COMMENT ON TABLE business_profiles IS 'Business identity captured by the BUSINESS application flow; queryable projection of the submitted step data.';
COMMENT ON TABLE business_members IS 'Authorized representatives, directors and requested team access for a business application.';
COMMENT ON TABLE beneficial_owners IS 'Beneficial owners and their ownership percentage for a business application.';
