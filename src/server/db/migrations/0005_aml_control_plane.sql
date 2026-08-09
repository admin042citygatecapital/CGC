-- Persist the compliance officer's AML decision independently from KYC.
-- Financial operations fail closed unless both KYC and AML are current.

ALTER TABLE users ADD COLUMN IF NOT EXISTS aml_status TEXT NOT NULL DEFAULT 'not_screened';
ALTER TABLE users ADD COLUMN IF NOT EXISTS aml_risk_level TEXT NOT NULL DEFAULT 'unrated';
ALTER TABLE users ADD COLUMN IF NOT EXISTS aml_reviewed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS aml_reviewed_by TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS aml_review_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS aml_next_review_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_aml_status_check
    CHECK (aml_status IN ('not_screened', 'pending', 'cleared', 'review', 'blocked'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_aml_risk_level_check
    CHECK (aml_risk_level IN ('unrated', 'low', 'medium', 'high'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS users_aml_status_idx ON users (aml_status);
CREATE INDEX IF NOT EXISTS users_aml_next_review_idx ON users (aml_next_review_at)
  WHERE aml_next_review_at IS NOT NULL;
