-- 0049_session_token_digests.sql
-- Persist only SHA-256 digests for administrator/customer session tokens.
--
-- Existing bearer tokens cannot be converted in place without continuing to
-- treat database contents as live credentials. Revoke those ephemeral
-- sessions first, then rename the now-empty columns for digest-only writes.
-- No customer, account, ledger, transaction, KYC, or other business data is
-- changed by this migration.

DO $$
DECLARE
  admin_raw BOOLEAN;
  admin_digest BOOLEAN;
  customer_raw BOOLEAN;
  customer_digest BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_sessions'
      AND column_name = 'token'
  ) INTO admin_raw;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_sessions'
      AND column_name = 'token_hash'
  ) INTO admin_digest;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customer_sessions'
      AND column_name = 'token'
  ) INTO customer_raw;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customer_sessions'
      AND column_name = 'token_hash'
  ) INTO customer_digest;

  IF admin_raw = admin_digest OR customer_raw = customer_digest THEN
    RAISE EXCEPTION
      'Unexpected session schema: each session table must have exactly one of token or token_hash';
  END IF;

  IF admin_digest AND customer_digest THEN
    -- Defensive idempotency for manual execution. The tracked migration runner
    -- applies this file once, but a rerun must not revoke newly issued sessions.
    RAISE NOTICE 'Session digest columns already present; no revocation required';
    RETURN;
  END IF;

  IF NOT (admin_raw AND customer_raw) THEN
    RAISE EXCEPTION
      'Partial session-token migration detected; refusing to modify authentication data';
  END IF;

  DELETE FROM admin_sessions;
  DELETE FROM customer_sessions;

  -- Trusted-device tokens previously lived as raw JSON object keys. Revoke the
  -- legacy set; new registrations persist prefixed SHA-256 digest keys and
  -- expose only independent opaque device IDs to administrative controls.
  DELETE FROM config WHERE key = 'trusted_devices';

  ALTER TABLE admin_sessions RENAME COLUMN token TO token_hash;
  ALTER TABLE customer_sessions RENAME COLUMN token TO token_hash;
END $$;

COMMENT ON COLUMN admin_sessions.token_hash IS
  'SHA-256 digest of the administrator bearer token; raw token is never persisted';
COMMENT ON COLUMN customer_sessions.token_hash IS
  'SHA-256 digest of the customer bearer token; raw token is never persisted';
