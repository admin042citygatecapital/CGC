-- 0102: Row-level security hardening for the multi-account application system.
--
-- The application's database role is the trusted, server-side accessor; the
-- server (service role) remains authoritative for every read and write. These
-- policies exist so the Supabase public Data API can never be used to reach
-- customer application or KYC data directly:
--   * anon / authenticated roles receive no table grants at all, and
--   * RLS is enabled with no permissive policy for those roles, so even a
--     future accidental grant leaks nothing.
-- Mirrors the private-KYC pattern established in migration 0056.

ALTER TABLE account_applications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_cases               ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_case_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_case_documents      ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE account_applications, application_events,
  kyc_cases, kyc_case_events, kyc_case_documents FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE account_applications, application_events,
      kyc_cases, kyc_case_events, kyc_case_documents FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE account_applications, application_events,
      kyc_cases, kyc_case_events, kyc_case_documents FROM authenticated;
  END IF;
END $$;

COMMENT ON TABLE account_applications IS 'Server-owned account applications. Customers read their own rows exclusively through the application API.';
COMMENT ON TABLE kyc_cases IS 'Server-owned KYC review cases; per-account-type review lifecycle. Direct Data-API access is blocked.';
COMMENT ON TABLE kyc_case_documents IS 'Metadata for KYC documents stored in the private Supabase Storage bucket; object bytes are never served from Postgres.';
