-- Separate public-registry identity from proof that the platform operator is
-- authorised to act for the proposed contracting entity. Metadata only: the
-- original resolution/certificate remains in the controlled source system.
ALTER TABLE legal_entity_profiles
  ADD COLUMN IF NOT EXISTS authority_type TEXT,
  ADD COLUMN IF NOT EXISTS authority_reference TEXT,
  ADD COLUMN IF NOT EXISTS authority_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS authorized_officer_ref TEXT,
  ADD COLUMN IF NOT EXISTS authority_issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS authority_expires_at TIMESTAMPTZ;

ALTER TABLE legal_entity_profiles
  DROP CONSTRAINT IF EXISTS legal_entity_authority_type_check,
  DROP CONSTRAINT IF EXISTS legal_entity_authority_hash_check,
  ADD CONSTRAINT legal_entity_authority_type_check
    CHECK (authority_type IS NULL OR authority_type IN ('board_resolution','officer_certificate','power_of_attorney','other')),
  ADD CONSTRAINT legal_entity_authority_hash_check
    CHECK (authority_sha256 IS NULL OR authority_sha256 ~ '^[a-f0-9]{64}$');
