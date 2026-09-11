-- Customer TOTP recovery codes: single-use backup codes for lost devices.
-- Only SHA-256 hashes are persisted; plaintext codes are shown once at enable
-- time and never stored (see src/server/lib/totp.ts).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_recovery_hashes JSONB;