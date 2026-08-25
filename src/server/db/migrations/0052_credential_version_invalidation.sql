-- Bind every authenticated artifact to the credential revision that issued it.
-- Password rotation increments the principal revision under an advisory lock;
-- stale sessions/challenges then fail closed even when issuance raced rotation.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS credential_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS credential_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE admin_sessions
  ADD COLUMN IF NOT EXISTS credential_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE customer_sessions
  ADD COLUMN IF NOT EXISTS credential_version INTEGER NOT NULL DEFAULT 1;

-- Reset links issued before credential-version binding cannot be proven to
-- belong to the current credential. Invalidate them before making the binding
-- mandatory; no customer or financial data is removed.
DELETE FROM customer_password_reset_tokens;

ALTER TABLE customer_password_reset_tokens
  ADD COLUMN IF NOT EXISTS credential_version INTEGER;
ALTER TABLE customer_password_reset_tokens ALTER COLUMN credential_version SET NOT NULL;

-- Existing OTP challenges predate principal/version binding and cannot be
-- proven safe after a credential rotation. They are short-lived and may be
-- invalidated without affecting persistent customer or financial data.
DELETE FROM admin_otp_challenges;

ALTER TABLE admin_otp_challenges
  ADD COLUMN IF NOT EXISTS admin_id TEXT REFERENCES admins(id) ON DELETE CASCADE;
ALTER TABLE admin_otp_challenges
  ADD COLUMN IF NOT EXISTS credential_version INTEGER;
ALTER TABLE admin_otp_challenges ALTER COLUMN admin_id SET NOT NULL;
ALTER TABLE admin_otp_challenges ALTER COLUMN credential_version SET NOT NULL;

CREATE INDEX IF NOT EXISTS admin_otp_challenges_admin_id_idx
  ON admin_otp_challenges(admin_id);

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_credential_version_positive
    CHECK (credential_version > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE admins ADD CONSTRAINT admins_credential_version_positive
    CHECK (credential_version > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE admin_sessions ADD CONSTRAINT admin_sessions_credential_version_positive
    CHECK (credential_version > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE customer_sessions ADD CONSTRAINT customer_sessions_credential_version_positive
    CHECK (credential_version > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE admin_otp_challenges ADD CONSTRAINT admin_otp_challenges_credential_version_positive
    CHECK (credential_version > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE customer_password_reset_tokens ADD CONSTRAINT customer_password_reset_tokens_credential_version_positive
    CHECK (credential_version > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
