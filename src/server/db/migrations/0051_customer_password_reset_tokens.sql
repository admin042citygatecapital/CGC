-- Single-use customer credential-recovery challenges.
-- Only SHA-256 token fingerprints are retained; raw tokens never enter storage.

CREATE TABLE IF NOT EXISTS customer_password_reset_tokens (
  token_hash  TEXT        PRIMARY KEY,
  user_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_password_reset_tokens_user_id_idx
  ON customer_password_reset_tokens (user_id);

CREATE INDEX IF NOT EXISTS customer_password_reset_tokens_expires_at_idx
  ON customer_password_reset_tokens (expires_at);
