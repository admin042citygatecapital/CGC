-- Synthetic-only administration financial sandbox.
-- These tables intentionally have no relationship to customer or provider money tables.
CREATE TABLE IF NOT EXISTS financial_sandbox_accounts (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_account_%' OR id LIKE 'syn_treasury_%'),
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('personal','savings','business','fiat_wallet','crypto_wallet','treasury')),
  asset TEXT NOT NULL CHECK (asset IN ('GBP','EUR','USD','CAD','AUD','CHF','BTC','ETH','USDT')),
  balance_minor BIGINT NOT NULL DEFAULT 0,
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  creation_idempotency_key TEXT NOT NULL UNIQUE,
  creation_fingerprint TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_sandbox_transactions (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_tx_%'),
  reference TEXT NOT NULL UNIQUE CHECK (reference LIKE 'SYN-%'),
  idempotency_key TEXT NOT NULL UNIQUE,
  idempotency_fingerprint TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('mock','internal_transfer','crypto_transfer','adjustment','reversal')),
  status TEXT NOT NULL CHECK (status IN ('pending','processing','completed','failed','reversed','cancelled')),
  asset TEXT NOT NULL CHECK (asset IN ('GBP','EUR','USD','CAD','AUD','CHF','BTC','ETH','USDT')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  source_account_id TEXT REFERENCES financial_sandbox_accounts(id) ON DELETE RESTRICT,
  destination_account_id TEXT REFERENCES financial_sandbox_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  execution_source TEXT NOT NULL DEFAULT 'SIMULATION' CHECK (execution_source = 'SIMULATION'),
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  reverses_id TEXT REFERENCES financial_sandbox_transactions(id) ON DELETE RESTRICT,
  cancellation_reason TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_account_id IS NOT NULL OR destination_account_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS financial_sandbox_journal_entries (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_je_%'),
  transaction_id TEXT NOT NULL UNIQUE REFERENCES financial_sandbox_transactions(id) ON DELETE RESTRICT,
  reference TEXT NOT NULL UNIQUE CHECK (reference LIKE 'SYN-JE-%'),
  asset TEXT NOT NULL,
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  posted_by TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_sandbox_journal_lines (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_jl_%'),
  journal_entry_id TEXT NOT NULL REFERENCES financial_sandbox_journal_entries(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES financial_sandbox_accounts(id) ON DELETE RESTRICT,
  asset TEXT NOT NULL,
  debit_minor BIGINT NOT NULL DEFAULT 0 CHECK (debit_minor >= 0),
  credit_minor BIGINT NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((debit_minor > 0 AND credit_minor = 0) OR (credit_minor > 0 AND debit_minor = 0))
);

CREATE TABLE IF NOT EXISTS financial_sandbox_commands (
  idempotency_key TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  action TEXT NOT NULL,
  result_type TEXT NOT NULL CHECK (result_type IN ('account','transaction')),
  result_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS financial_sandbox_accounts_asset_idx ON financial_sandbox_accounts(asset, updated_at);
CREATE INDEX IF NOT EXISTS financial_sandbox_transactions_status_idx ON financial_sandbox_transactions(status, created_at);
CREATE INDEX IF NOT EXISTS financial_sandbox_journal_lines_entry_idx ON financial_sandbox_journal_lines(journal_entry_id);

CREATE OR REPLACE FUNCTION validate_financial_sandbox_journal_balance() RETURNS TRIGGER AS $$
DECLARE debit_total BIGINT; credit_total BIGINT;
BEGIN
  SELECT COALESCE(SUM(debit_minor), 0), COALESCE(SUM(credit_minor), 0)
    INTO debit_total, credit_total
    FROM financial_sandbox_journal_lines
   WHERE journal_entry_id = NEW.journal_entry_id;
  IF debit_total <> credit_total THEN
    RAISE EXCEPTION 'Unbalanced synthetic journal entry %', NEW.journal_entry_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS financial_sandbox_balance_guard ON financial_sandbox_journal_lines;
CREATE CONSTRAINT TRIGGER financial_sandbox_balance_guard
AFTER INSERT OR UPDATE ON financial_sandbox_journal_lines
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION validate_financial_sandbox_journal_balance();

CREATE OR REPLACE FUNCTION prevent_financial_sandbox_journal_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Synthetic journal records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS financial_sandbox_lines_immutable ON financial_sandbox_journal_lines;
CREATE TRIGGER financial_sandbox_lines_immutable BEFORE UPDATE OR DELETE ON financial_sandbox_journal_lines
FOR EACH ROW EXECUTE FUNCTION prevent_financial_sandbox_journal_mutation();
DROP TRIGGER IF EXISTS financial_sandbox_entries_immutable ON financial_sandbox_journal_entries;
CREATE TRIGGER financial_sandbox_entries_immutable BEFORE UPDATE OR DELETE ON financial_sandbox_journal_entries
FOR EACH ROW EXECUTE FUNCTION prevent_financial_sandbox_journal_mutation();

-- The simulation is server-administered. Keep every synthetic ledger table
-- unavailable to Supabase's public Data API and use RLS as defense in depth.
ALTER TABLE financial_sandbox_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_sandbox_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_sandbox_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_sandbox_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_sandbox_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE financial_sandbox_accounts FROM PUBLIC;
REVOKE ALL ON TABLE financial_sandbox_transactions FROM PUBLIC;
REVOKE ALL ON TABLE financial_sandbox_journal_entries FROM PUBLIC;
REVOKE ALL ON TABLE financial_sandbox_journal_lines FROM PUBLIC;
REVOKE ALL ON TABLE financial_sandbox_commands FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION validate_financial_sandbox_journal_balance() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION prevent_financial_sandbox_journal_mutation() FROM PUBLIC;

INSERT INTO schema_migrations (version) VALUES ('0028_financial_sandbox_ledger') ON CONFLICT (version) DO NOTHING;
