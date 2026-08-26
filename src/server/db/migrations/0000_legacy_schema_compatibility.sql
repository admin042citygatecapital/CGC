-- City Gate Capital legacy schema compatibility bridge.
--
-- Some early Supabase environments were provisioned before the repository's
-- migration ledger became authoritative.  In those environments the tables
-- already exist, but use older column names.  CREATE TABLE IF NOT EXISTS in
-- 0001 cannot reconcile those shapes, so its canonical indexes fail.
--
-- This migration is deliberately additive and idempotent:
--   * no tables or rows are removed;
--   * no migration versions are forged;
--   * no balances or financial records are changed;
--   * values are copied only where an exact legacy alias exists.

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS name TEXT,
      ADD COLUMN IF NOT EXISTS email_verify_token TEXT,
      ADD COLUMN IF NOT EXISTS email_verify_expiry TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ip TEXT,
      ADD COLUMN IF NOT EXISTS id_document_url TEXT,
      ADD COLUMN IF NOT EXISTS kyc_rejected_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS selfie_url TEXT,
      ADD COLUMN IF NOT EXISTS primary_currency TEXT DEFAULT 'USD',
      ADD COLUMN IF NOT EXISTS notification_prefs JSONB,
      ADD COLUMN IF NOT EXISTS beneficiaries JSONB,
      ADD COLUMN IF NOT EXISTS trusted_devices JSONB,
      ADD COLUMN IF NOT EXISTS totp_secret TEXT,
      ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS locale TEXT,
      ADD COLUMN IF NOT EXISTS timezone TEXT;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'first_name'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_name'
    ) THEN
      UPDATE public.users
      SET name = NULLIF(BTRIM(CONCAT_WS(' ', first_name, last_name)), '')
      WHERE name IS NULL;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'verify_token'
    ) THEN
      UPDATE public.users SET email_verify_token = verify_token
      WHERE email_verify_token IS NULL AND verify_token IS NOT NULL;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'verify_token_expires_at'
    ) THEN
      UPDATE public.users SET email_verify_expiry = verify_token_expires_at
      WHERE email_verify_expiry IS NULL AND verify_token_expires_at IS NOT NULL;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'failed_login_count'
    ) THEN
      UPDATE public.users SET login_attempts = COALESCE(failed_login_count, 0)
      WHERE login_attempts IS NULL OR login_attempts = 0;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'registration_ip'
    ) THEN
      UPDATE public.users SET ip = registration_ip
      WHERE ip IS NULL AND registration_ip IS NOT NULL;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_login_ip'
    ) THEN
      UPDATE public.users SET ip = last_login_ip
      WHERE ip IS NULL AND last_login_ip IS NOT NULL;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'kyc_document_url'
    ) THEN
      UPDATE public.users SET id_document_url = kyc_document_url
      WHERE id_document_url IS NULL AND kyc_document_url IS NOT NULL;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'kyc_selfie_url'
    ) THEN
      UPDATE public.users SET selfie_url = kyc_selfie_url
      WHERE selfie_url IS NULL AND kyc_selfie_url IS NOT NULL;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'currency'
    ) THEN
      UPDATE public.users SET primary_currency = COALESCE(NULLIF(currency, ''), 'USD')
      WHERE primary_currency IS NULL OR primary_currency = '';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'two_fa_secret'
    ) THEN
      UPDATE public.users SET totp_secret = two_fa_secret
      WHERE totp_secret IS NULL AND two_fa_secret IS NOT NULL;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'two_fa_enabled'
    ) THEN
      UPDATE public.users SET totp_enabled = COALESCE(two_fa_enabled, FALSE)
      WHERE totp_enabled IS NULL OR totp_enabled = FALSE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.admin_sessions') IS NOT NULL THEN
    ALTER TABLE public.admin_sessions ADD COLUMN IF NOT EXISTS ua TEXT;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_sessions' AND column_name = 'user_agent'
    ) THEN
      UPDATE public.admin_sessions SET ua = user_agent
      WHERE ua IS NULL AND user_agent IS NOT NULL;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL THEN
    ALTER TABLE public.transactions
      ADD COLUMN IF NOT EXISTS wallet_address TEXT,
      ADD COLUMN IF NOT EXISTS network TEXT,
      ADD COLUMN IF NOT EXISTS tx_hash TEXT,
      ADD COLUMN IF NOT EXISTS bank_name TEXT,
      ADD COLUMN IF NOT EXISTS account_number TEXT,
      ADD COLUMN IF NOT EXISTS routing_number TEXT,
      ADD COLUMN IF NOT EXISTS swift_code TEXT,
      ADD COLUMN IF NOT EXISTS ip TEXT;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'crypto_address') THEN
      UPDATE public.transactions SET wallet_address = crypto_address WHERE wallet_address IS NULL AND crypto_address IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'crypto_network') THEN
      UPDATE public.transactions SET network = crypto_network WHERE network IS NULL AND crypto_network IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'crypto_tx_hash') THEN
      UPDATE public.transactions SET tx_hash = crypto_tx_hash WHERE tx_hash IS NULL AND crypto_tx_hash IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'wire_bank_name') THEN
      UPDATE public.transactions SET bank_name = wire_bank_name WHERE bank_name IS NULL AND wire_bank_name IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'wire_account_number') THEN
      UPDATE public.transactions SET account_number = wire_account_number WHERE account_number IS NULL AND wire_account_number IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'wire_routing_number') THEN
      UPDATE public.transactions SET routing_number = wire_routing_number WHERE routing_number IS NULL AND wire_routing_number IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'wire_swift') THEN
      UPDATE public.transactions SET swift_code = wire_swift WHERE swift_code IS NULL AND wire_swift IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'ip_address') THEN
      UPDATE public.transactions SET ip = ip_address WHERE ip IS NULL AND ip_address IS NOT NULL;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.kyc_notes') IS NOT NULL THEN
    ALTER TABLE public.kyc_notes ADD COLUMN IF NOT EXISTS admin_name TEXT;
  END IF;
  IF to_regclass('public.kyc_settings') IS NOT NULL THEN
    ALTER TABLE public.kyc_settings ADD COLUMN IF NOT EXISTS updated_by TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.support_conversations') IS NOT NULL THEN
    ALTER TABLE public.support_conversations
      ADD COLUMN IF NOT EXISTS user_name TEXT,
      ADD COLUMN IF NOT EXISTS user_email TEXT,
      ADD COLUMN IF NOT EXISTS category TEXT;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'support_conversations' AND column_name = 'guest_name') THEN
      UPDATE public.support_conversations SET user_name = guest_name WHERE user_name IS NULL AND guest_name IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'support_conversations' AND column_name = 'guest_email') THEN
      UPDATE public.support_conversations SET user_email = guest_email WHERE user_email IS NULL AND guest_email IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'support_conversations' AND column_name = 'department') THEN
      UPDATE public.support_conversations SET category = department WHERE category IS NULL AND department IS NOT NULL;
    END IF;
  END IF;

  IF to_regclass('public.support_messages') IS NOT NULL THEN
    ALTER TABLE public.support_messages
      ADD COLUMN IF NOT EXISTS "from" TEXT,
      ADD COLUMN IF NOT EXISTS text TEXT,
      ADD COLUMN IF NOT EXISTS admin_name TEXT,
      ADD COLUMN IF NOT EXISTS ts TIMESTAMPTZ;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'support_messages' AND column_name = 'sender_type') THEN
      UPDATE public.support_messages SET "from" = sender_type WHERE "from" IS NULL AND sender_type IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'support_messages' AND column_name = 'body') THEN
      UPDATE public.support_messages SET text = body WHERE text IS NULL AND body IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'support_messages' AND column_name = 'sender_name') THEN
      UPDATE public.support_messages SET admin_name = sender_name WHERE admin_name IS NULL AND sender_name IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'support_messages' AND column_name = 'created_at') THEN
      UPDATE public.support_messages SET ts = created_at WHERE ts IS NULL;
    END IF;
  END IF;

  IF to_regclass('public.support_notes') IS NOT NULL THEN
    ALTER TABLE public.support_notes
      ADD COLUMN IF NOT EXISTS text TEXT,
      ADD COLUMN IF NOT EXISTS admin_name TEXT,
      ADD COLUMN IF NOT EXISTS ts TIMESTAMPTZ;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'support_notes' AND column_name = 'body') THEN
      UPDATE public.support_notes SET text = body WHERE text IS NULL AND body IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'support_notes' AND column_name = 'created_at') THEN
      UPDATE public.support_notes SET ts = created_at WHERE ts IS NULL;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    ALTER TABLE public.audit_log
      ADD COLUMN IF NOT EXISTS admin_id TEXT,
      ADD COLUMN IF NOT EXISTS admin_email TEXT,
      ADD COLUMN IF NOT EXISTS target TEXT,
      ADD COLUMN IF NOT EXISTS target_id TEXT,
      ADD COLUMN IF NOT EXISTS ts TIMESTAMPTZ;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'actor_id') THEN
      UPDATE public.audit_log SET admin_id = actor_id WHERE admin_id IS NULL AND actor_id IS NOT NULL;
      UPDATE public.audit_log SET admin_email = actor_id
      WHERE admin_email IS NULL AND actor_id LIKE '%@%';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'resource_type') THEN
      UPDATE public.audit_log SET target = resource_type WHERE target IS NULL AND resource_type IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'resource_id') THEN
      UPDATE public.audit_log SET target_id = resource_id WHERE target_id IS NULL AND resource_id IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'created_at') THEN
      UPDATE public.audit_log SET ts = created_at WHERE ts IS NULL;
    END IF;
  END IF;

  IF to_regclass('public.email_queue') IS NOT NULL THEN
    ALTER TABLE public.email_queue
      ADD COLUMN IF NOT EXISTS "from" TEXT,
      ADD COLUMN IF NOT EXISTS reply_to TEXT,
      ADD COLUMN IF NOT EXISTS last_error TEXT,
      ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_queue' AND column_name = 'error_message') THEN
      UPDATE public.email_queue SET last_error = error_message WHERE last_error IS NULL AND error_message IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_queue' AND column_name = 'created_at') THEN
      UPDATE public.email_queue SET scheduled_at = created_at WHERE scheduled_at IS NULL;
    END IF;
  END IF;
END $$;
