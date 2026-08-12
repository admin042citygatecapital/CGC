-- Store the effective KYC expiry explicitly so extensions and lifecycle
-- reporting do not rewrite or infer the original approval timestamp.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS kyc_expires_at TIMESTAMPTZ;

-- Backfill current approvals using the configured policy. PostgreSQL interval
-- months preserve calendar-month semantics better than fixed 30-day windows.
UPDATE users
SET kyc_expires_at = kyc_approved_at + make_interval(months => COALESCE(
  (SELECT expiry_months FROM kyc_settings WHERE id = 1),
  12
))
WHERE kyc_status = 'approved'
  AND kyc_approved_at IS NOT NULL
  AND kyc_expires_at IS NULL;

CREATE INDEX IF NOT EXISTS users_kyc_expires_at_idx ON users(kyc_expires_at);
