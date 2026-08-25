-- 0050_admin_otp_challenges.sql
-- Persist administrator email verification challenges across restarts and
-- instances without storing the raw challenge identifier, OTP, IP address,
-- or user-agent string.

CREATE TABLE IF NOT EXISTS admin_otp_challenges (
  challenge_id_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  ua_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  CONSTRAINT admin_otp_challenge_id_hash_sha256 CHECK (challenge_id_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT admin_otp_value_hash_sha256 CHECK (otp_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT admin_otp_ip_hash_sha256 CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT admin_otp_ua_hash_sha256 CHECK (ua_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT admin_otp_attempts_range CHECK (attempts BETWEEN 0 AND 5)
);

CREATE INDEX IF NOT EXISTS admin_otp_challenges_email_created_idx
  ON admin_otp_challenges (email, created_at);

CREATE INDEX IF NOT EXISTS admin_otp_challenges_expires_at_idx
  ON admin_otp_challenges (expires_at);

COMMENT ON TABLE admin_otp_challenges IS
  'Short-lived, single-use administrator email verification challenges; sensitive inputs are stored only as SHA-256 digests';
