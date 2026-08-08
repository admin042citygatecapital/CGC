-- ============================================================================
-- City Gate Capital — Initial PostgreSQL Schema
-- Migration: 0001_initial_schema
-- Database:  Neon (PostgreSQL 16)
--
-- Run this ONCE against your Neon database before starting the app.
-- Usage:
--   psql "$DATABASE_URL" -f src/server/db/migrations/0001_initial_schema.sql
--
-- Or use the migration runner:
--   npx tsx src/server/db/migrate.ts
-- ============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM (
    'pending_verification', 'pending_kyc', 'pending_approval',
    'active', 'suspended', 'frozen', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE kyc_status AS ENUM (
    'not_submitted', 'submitted', 'approved', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tx_type AS ENUM (
    'deposit', 'withdrawal', 'transfer', 'crypto_buy', 'crypto_sell',
    'wire_transfer', 'fee', 'refund', 'manual_credit', 'manual_debit'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tx_status AS ENUM (
    'pending', 'completed', 'failed', 'rejected', 'flagged', 'frozen'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tx_currency AS ENUM (
    'USD', 'EUR', 'GBP', 'BTC', 'ETH', 'USDT', 'BNB', 'SOL',
    'CHF', 'JPY', 'CAD', 'AUD', 'SGD', 'AED', 'NGN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE admin_role AS ENUM (
    'SUPER_ADMIN', 'FINANCE_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN', 'COMPLIANCE_ADMIN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_side AS ENUM ('buy', 'sell');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_type AS ENUM ('market', 'limit', 'stop', 'stop_limit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending', 'open', 'filled', 'partially_filled', 'cancelled', 'rejected', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE position_status AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE asset_class AS ENUM ('crypto', 'forex', 'stock', 'commodity', 'etf');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE support_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE support_status AS ENUM (
    'open', 'pending', 'in_progress', 'resolved', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE login_actor AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE login_result AS ENUM (
    'success', 'failed', 'blocked', 'totp_failed', 'otp_sent', 'otp_failed',
    'account_locked', 'status_denied'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE email_queue_status AS ENUM (
    'queued', 'sending', 'sent', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_tier AS ENUM ('personal', 'savings', 'business');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── users ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                   TEXT PRIMARY KEY,
  email                TEXT NOT NULL,
  name                 TEXT NOT NULL,
  phone                TEXT,
  country              TEXT,
  status               user_status NOT NULL DEFAULT 'pending_verification',
  kyc_status           kyc_status NOT NULL DEFAULT 'not_submitted',
  email_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  email_verify_token   TEXT,
  email_verify_expiry  TIMESTAMPTZ,
  password_hash        TEXT NOT NULL,
  login_attempts       INTEGER NOT NULL DEFAULT 0,
  last_login_at        TIMESTAMPTZ,
  last_login_ip        TEXT,
  ip                   TEXT,
  balance              DOUBLE PRECISION DEFAULT 0,
  bank_name            TEXT,
  bank_account_number  TEXT,
  bank_routing_number  TEXT,
  bank_swift           TEXT,
  bank_iban            TEXT,
  wallet_btc           TEXT,
  wallet_eth           TEXT,
  wallet_usdt          TEXT,
  wallet_sol           TEXT,
  avatar_url           TEXT,
  date_of_birth        TEXT,
  address              TEXT,
  city                 TEXT,
  postal_code          TEXT,
  id_type              TEXT,
  id_number            TEXT,
  id_document_url      TEXT,
  kyc_submitted_at     TIMESTAMPTZ,
  kyc_approved_at      TIMESTAMPTZ,
  kyc_rejected_at      TIMESTAMPTZ,
  kyc_rejection_reason TEXT,
  selfie_url           TEXT,
  approved_at          TIMESTAMPTZ,
  approved_by          TEXT,
  rejected_at          TIMESTAMPTZ,
  rejected_by          TEXT,
  rejection_reason     TEXT,
  primary_currency     TEXT DEFAULT 'USD',
  account_tier         account_tier DEFAULT 'personal',
  notification_prefs   JSONB,
  beneficiaries        JSONB,
  trusted_devices      JSONB,
  totp_secret          TEXT,
  totp_enabled         BOOLEAN DEFAULT FALSE,
  locale               TEXT,
  timezone             TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx       ON users (LOWER(email));
CREATE INDEX        IF NOT EXISTS users_status_idx      ON users (status);
CREATE INDEX        IF NOT EXISTS users_kyc_status_idx  ON users (kyc_status);
CREATE INDEX        IF NOT EXISTS users_created_at_idx  ON users (created_at DESC);

-- ── admin_sessions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_sessions (
  token        TEXT PRIMARY KEY,
  admin_id     TEXT NOT NULL,
  email        TEXT NOT NULL,
  role         admin_role NOT NULL,
  ip           TEXT NOT NULL,
  ua           TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_admin_id_idx  ON admin_sessions (admin_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx ON admin_sessions (expires_at);

-- ── customer_sessions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_sessions (
  token        TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip           TEXT,
  ua           TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS customer_sessions_user_id_idx   ON customer_sessions (user_id);
CREATE INDEX IF NOT EXISTS customer_sessions_expires_at_idx ON customer_sessions (expires_at);

-- ── transactions ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id                TEXT PRIMARY KEY,
  type              tx_type NOT NULL,
  status            tx_status NOT NULL DEFAULT 'pending',
  user_id           TEXT NOT NULL,
  user_name         TEXT NOT NULL,
  user_email        TEXT NOT NULL,
  amount            DOUBLE PRECISION NOT NULL,
  currency          tx_currency NOT NULL,
  reference         TEXT NOT NULL,
  description       TEXT NOT NULL,
  note              TEXT,
  wallet_address    TEXT,
  network           TEXT,
  tx_hash           TEXT,
  bank_name         TEXT,
  account_number    TEXT,
  routing_number    TEXT,
  swift_code        TEXT,
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  rejected_by       TEXT,
  rejected_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  frozen_by         TEXT,
  frozen_at         TIMESTAMPTZ,
  admin_note        TEXT,
  flagged           BOOLEAN NOT NULL DEFAULT FALSE,
  ip                TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX        IF NOT EXISTS transactions_user_id_idx    ON transactions (user_id);
CREATE INDEX        IF NOT EXISTS transactions_status_idx     ON transactions (status);
CREATE INDEX        IF NOT EXISTS transactions_type_idx       ON transactions (type);
CREATE INDEX        IF NOT EXISTS transactions_created_at_idx ON transactions (created_at DESC);
CREATE INDEX        IF NOT EXISTS transactions_flagged_idx    ON transactions (flagged);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_reference_idx  ON transactions (reference);

-- ── cards ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cards (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  number_enc       TEXT NOT NULL,
  cvv_enc          TEXT NOT NULL,
  last4            TEXT NOT NULL,
  expiry           TEXT NOT NULL,
  cardholder_name  TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'virtual',
  network          TEXT NOT NULL DEFAULT 'Visa',
  status           TEXT NOT NULL DEFAULT 'active',
  frozen           BOOLEAN NOT NULL DEFAULT FALSE,
  spending_limit   DOUBLE PRECISION,
  pin              TEXT,
  color            TEXT DEFAULT '#1a1a2e',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cards_user_id_idx ON cards (user_id);
CREATE INDEX IF NOT EXISTS cards_status_idx  ON cards (status);

-- ── card_activity ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS card_activity (
  id          TEXT PRIMARY KEY,
  card_id     TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  type        TEXT NOT NULL,
  amount      DOUBLE PRECISION,
  currency    TEXT,
  merchant    TEXT,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'completed',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS card_activity_card_id_idx ON card_activity (card_id);
CREATE INDEX IF NOT EXISTS card_activity_user_id_idx ON card_activity (user_id);

-- ── wallets ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallets (
  id             TEXT PRIMARY KEY,
  symbol         TEXT NOT NULL,
  name           TEXT NOT NULL,
  network        TEXT NOT NULL,
  address        TEXT NOT NULL DEFAULT '',
  qr_code        TEXT,
  min_deposit    DOUBLE PRECISION NOT NULL DEFAULT 0,
  confirmations  INTEGER NOT NULL DEFAULT 1,
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by     TEXT
);

-- ── kyc_notes ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_notes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  admin_id   TEXT NOT NULL,
  admin_name TEXT,
  note       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kyc_notes_user_id_idx ON kyc_notes (user_id);

-- ── kyc_settings ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_settings (
  id                    INTEGER PRIMARY KEY DEFAULT 1,
  expiry_months         INTEGER NOT NULL DEFAULT 12,
  renewal_reminder_days INTEGER NOT NULL DEFAULT 30,
  auto_restrict_expired BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by            TEXT
);

INSERT INTO kyc_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── trading_positions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trading_positions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  symbol          TEXT NOT NULL,
  asset_class     asset_class NOT NULL,
  side            order_side NOT NULL,
  quantity        DOUBLE PRECISION NOT NULL,
  avg_entry_price DOUBLE PRECISION NOT NULL,
  current_price   DOUBLE PRECISION NOT NULL,
  unrealised_pnl  DOUBLE PRECISION NOT NULL DEFAULT 0,
  realised_pnl    DOUBLE PRECISION NOT NULL DEFAULT 0,
  status          position_status NOT NULL DEFAULT 'open',
  currency        TEXT NOT NULL DEFAULT 'USD',
  leverage        DOUBLE PRECISION NOT NULL DEFAULT 1,
  stop_loss       DOUBLE PRECISION,
  take_profit     DOUBLE PRECISION,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS trading_positions_user_id_idx ON trading_positions (user_id);
CREATE INDEX IF NOT EXISTS trading_positions_status_idx  ON trading_positions (status);
CREATE INDEX IF NOT EXISTS trading_positions_symbol_idx  ON trading_positions (symbol);

-- ── trading_orders ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trading_orders (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  symbol         TEXT NOT NULL,
  asset_class    asset_class NOT NULL,
  side           order_side NOT NULL,
  type           order_type NOT NULL,
  status         order_status NOT NULL DEFAULT 'pending',
  quantity       DOUBLE PRECISION NOT NULL,
  price          DOUBLE PRECISION,
  stop_price     DOUBLE PRECISION,
  filled_qty     DOUBLE PRECISION NOT NULL DEFAULT 0,
  avg_fill_price DOUBLE PRECISION,
  fee            DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'USD',
  position_id    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS trading_orders_user_id_idx ON trading_orders (user_id);
CREATE INDEX IF NOT EXISTS trading_orders_status_idx  ON trading_orders (status);
CREATE INDEX IF NOT EXISTS trading_orders_symbol_idx  ON trading_orders (symbol);

-- ── trading_trades ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trading_trades (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  order_id    TEXT NOT NULL,
  position_id TEXT,
  symbol      TEXT NOT NULL,
  asset_class asset_class NOT NULL,
  side        order_side NOT NULL,
  quantity    DOUBLE PRECISION NOT NULL,
  price       DOUBLE PRECISION NOT NULL,
  fee         DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'USD',
  pnl         DOUBLE PRECISION,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trading_trades_user_id_idx     ON trading_trades (user_id);
CREATE INDEX IF NOT EXISTS trading_trades_symbol_idx      ON trading_trades (symbol);
CREATE INDEX IF NOT EXISTS trading_trades_executed_at_idx ON trading_trades (executed_at DESC);

-- ── trading_watchlist ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trading_watchlist (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  asset_class asset_class NOT NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX        IF NOT EXISTS trading_watchlist_user_id_idx     ON trading_watchlist (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS trading_watchlist_user_symbol_idx ON trading_watchlist (user_id, symbol);

-- ── notifications ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  link       TEXT,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx    ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx       ON notifications (read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);

-- ── support_conversations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_conversations (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  user_name      TEXT NOT NULL,
  user_email     TEXT NOT NULL,
  subject        TEXT NOT NULL,
  category       TEXT NOT NULL,
  priority       support_priority NOT NULL DEFAULT 'medium',
  status         support_status NOT NULL DEFAULT 'open',
  assigned_to    TEXT,
  first_reply_at TIMESTAMPTZ,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_conversations_user_id_idx    ON support_conversations (user_id);
CREATE INDEX IF NOT EXISTS support_conversations_status_idx     ON support_conversations (status);
CREATE INDEX IF NOT EXISTS support_conversations_created_at_idx ON support_conversations (created_at DESC);

-- ── support_messages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  "from"          TEXT NOT NULL,
  text            TEXT NOT NULL,
  admin_name      TEXT,
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_messages_conversation_id_idx ON support_messages (conversation_id);

-- ── support_notes ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_notes (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  admin_id        TEXT NOT NULL,
  admin_name      TEXT,
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_notes_conversation_id_idx ON support_notes (conversation_id);

-- ── canned_responses ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS canned_responses (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  category   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── login_events ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS login_events (
  id         TEXT PRIMARY KEY,
  ts         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor      login_actor NOT NULL,
  email      TEXT NOT NULL,
  user_id    TEXT,
  result     login_result NOT NULL,
  ip         TEXT NOT NULL,
  ua         TEXT NOT NULL,
  device     TEXT NOT NULL,
  browser    TEXT NOT NULL,
  os         TEXT NOT NULL,
  country    TEXT NOT NULL,
  reason     TEXT,
  session_id TEXT,
  duration   INTEGER
);

CREATE INDEX IF NOT EXISTS login_events_email_idx   ON login_events (email);
CREATE INDEX IF NOT EXISTS login_events_user_id_idx ON login_events (user_id);
CREATE INDEX IF NOT EXISTS login_events_ts_idx      ON login_events (ts DESC);
CREATE INDEX IF NOT EXISTS login_events_result_idx  ON login_events (result);

-- ── audit_log ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  action      TEXT NOT NULL,
  target      TEXT,
  target_id   TEXT,
  details     JSONB,
  ip          TEXT,
  ts          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_admin_id_idx ON audit_log (admin_id);
CREATE INDEX IF NOT EXISTS audit_log_ts_idx       ON audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx   ON audit_log (action);

-- ── config ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- ── email_queue ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_queue (
  id           TEXT PRIMARY KEY,
  "to"         TEXT NOT NULL,
  subject      TEXT NOT NULL,
  html         TEXT NOT NULL,
  "from"       TEXT,
  reply_to     TEXT,
  status       email_queue_status NOT NULL DEFAULT 'queued',
  attempts     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error   TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_queue_status_idx       ON email_queue (status);
CREATE INDEX IF NOT EXISTS email_queue_scheduled_at_idx ON email_queue (scheduled_at);

-- ── subscribers ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscribers (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL,
  name             TEXT,
  status           TEXT NOT NULL DEFAULT 'active',
  source           TEXT,
  tags             JSONB,
  subscribed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS subscribers_email_idx ON subscribers (LOWER(email));

-- ── Schema version tracking ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('0001_initial_schema')
ON CONFLICT (version) DO NOTHING;
