-- Customer-facing product account registry.
-- These records describe application accounts only. They are synthetic and do
-- not represent bank accounts, safeguarded funds, custody or provider ledgers.

CREATE TABLE IF NOT EXISTS platform_currencies (
  code TEXT PRIMARY KEY CHECK (code ~ '^[A-Z]{3,5}$'),
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  flag TEXT NOT NULL DEFAULT '',
  decimals INTEGER NOT NULL CHECK (decimals BETWEEN 0 AND 8),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_currencies (code, name, symbol, flag, decimals, display_order)
VALUES
  ('GBP', 'British Pound', '£', '🇬🇧', 2, 10),
  ('EUR', 'Euro', '€', '🇪🇺', 2, 20),
  ('USD', 'US Dollar', '$', '🇺🇸', 2, 30),
  ('CAD', 'Canadian Dollar', 'C$', '🇨🇦', 2, 40),
  ('AUD', 'Australian Dollar', 'A$', '🇦🇺', 2, 50),
  ('CHF', 'Swiss Franc', 'CHF', '🇨🇭', 2, 60)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS customer_accounts (
  id TEXT PRIMARY KEY CHECK (id LIKE 'acct_syn_%'),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('personal','savings','business')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','restricted','closed')),
  primary_currency TEXT NOT NULL REFERENCES platform_currencies(code) ON DELETE RESTRICT,
  available_minor BIGINT NOT NULL DEFAULT 0 CHECK (available_minor >= 0),
  ledger_minor BIGINT NOT NULL DEFAULT 0 CHECK (ledger_minor >= 0),
  pending_minor BIGINT NOT NULL DEFAULT 0 CHECK (pending_minor >= 0),
  restrictions JSONB NOT NULL DEFAULT '[]'::JSONB,
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  creation_idempotency_key TEXT NOT NULL UNIQUE,
  creation_fingerprint TEXT NOT NULL,
  created_by TEXT NOT NULL,
  last_edited_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (available_minor = ledger_minor - pending_minor),
  UNIQUE (user_id, account_type, primary_currency)
);

CREATE INDEX IF NOT EXISTS customer_accounts_user_idx ON customer_accounts(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS customer_accounts_status_idx ON customer_accounts(status, updated_at DESC);

ALTER TABLE platform_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE platform_currencies FROM PUBLIC;
REVOKE ALL ON TABLE customer_accounts FROM PUBLIC;

INSERT INTO schema_migrations (version)
VALUES ('0029_customer_account_registry')
ON CONFLICT (version) DO NOTHING;
