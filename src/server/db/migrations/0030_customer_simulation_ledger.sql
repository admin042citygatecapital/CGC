-- Customer-owned simulation ledger.
-- This is an application-only double-entry model. It cannot represent provider
-- funds, settlement, custody, bank accounts or live payment execution.

CREATE TABLE IF NOT EXISTS customer_ledger_accounts (
  id TEXT PRIMARY KEY CHECK (id LIKE 'cl_acct_%' OR id LIKE 'cl_treasury_%'),
  customer_account_id TEXT UNIQUE REFERENCES customer_accounts(id) ON DELETE RESTRICT,
  owner_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  account_class TEXT NOT NULL CHECK (account_class IN ('customer','simulation_treasury')),
  currency TEXT NOT NULL REFERENCES platform_currencies(code) ON DELETE RESTRICT,
  balance_minor BIGINT NOT NULL DEFAULT 0 CHECK (balance_minor >= 0),
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (account_class = 'customer' AND customer_account_id IS NOT NULL AND owner_user_id IS NOT NULL)
    OR
    (account_class = 'simulation_treasury' AND customer_account_id IS NULL AND owner_user_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_ledger_treasury_currency_idx
  ON customer_ledger_accounts(currency)
  WHERE account_class = 'simulation_treasury';
CREATE INDEX IF NOT EXISTS customer_ledger_owner_idx
  ON customer_ledger_accounts(owner_user_id, updated_at DESC);

INSERT INTO customer_ledger_accounts
  (id, customer_account_id, owner_user_id, name, account_class, currency, balance_minor)
SELECT
  'cl_acct_' || SUBSTRING(id FROM 10), id, user_id, label,
  'customer', primary_currency, ledger_minor
FROM customer_accounts
ON CONFLICT (customer_account_id) DO NOTHING;

INSERT INTO customer_ledger_accounts
  (id, name, account_class, currency, balance_minor)
SELECT
  'cl_treasury_' || LOWER(code), code || ' simulation treasury',
  'simulation_treasury', code, 0
FROM platform_currencies
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS customer_simulation_transactions (
  id TEXT PRIMARY KEY CHECK (id LIKE 'ctx_syn_%'),
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reference TEXT NOT NULL UNIQUE CHECK (reference LIKE 'CGC-SIM-%'),
  kind TEXT NOT NULL CHECK (kind IN ('opening_adjustment','internal_transfer','controlled_adjustment','reversal')),
  status TEXT NOT NULL CHECK (status IN ('pending','processing','completed','failed','reversed','cancelled')),
  currency TEXT NOT NULL REFERENCES platform_currencies(code) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  source_ledger_account_id TEXT REFERENCES customer_ledger_accounts(id) ON DELETE RESTRICT,
  destination_ledger_account_id TEXT REFERENCES customer_ledger_accounts(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  execution_source TEXT NOT NULL DEFAULT 'SIMULATION' CHECK (execution_source = 'SIMULATION'),
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  reverses_id TEXT REFERENCES customer_simulation_transactions(id) ON DELETE RESTRICT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_ledger_account_id IS NOT NULL OR destination_ledger_account_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS customer_simulation_journal_entries (
  id TEXT PRIMARY KEY CHECK (id LIKE 'cje_syn_%'),
  transaction_id TEXT NOT NULL UNIQUE REFERENCES customer_simulation_transactions(id) ON DELETE RESTRICT,
  reference TEXT NOT NULL UNIQUE CHECK (reference LIKE 'CGC-SIM-JE-%'),
  currency TEXT NOT NULL REFERENCES platform_currencies(code) ON DELETE RESTRICT,
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  posted_by TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_simulation_journal_lines (
  id TEXT PRIMARY KEY CHECK (id LIKE 'cjl_syn_%'),
  journal_entry_id TEXT NOT NULL REFERENCES customer_simulation_journal_entries(id) ON DELETE RESTRICT,
  ledger_account_id TEXT NOT NULL REFERENCES customer_ledger_accounts(id) ON DELETE RESTRICT,
  currency TEXT NOT NULL REFERENCES platform_currencies(code) ON DELETE RESTRICT,
  debit_minor BIGINT NOT NULL DEFAULT 0 CHECK (debit_minor >= 0),
  credit_minor BIGINT NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((debit_minor > 0 AND credit_minor = 0) OR (credit_minor > 0 AND debit_minor = 0))
);

CREATE TABLE IF NOT EXISTS customer_simulation_commands (
  actor_scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  action TEXT NOT NULL,
  transaction_id TEXT NOT NULL REFERENCES customer_simulation_transactions(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (actor_scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS customer_simulation_transactions_owner_idx
  ON customer_simulation_transactions(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_simulation_transactions_status_idx
  ON customer_simulation_transactions(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS customer_simulation_one_reversal_idx
  ON customer_simulation_transactions(reverses_id)
  WHERE reverses_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS customer_simulation_lines_entry_idx
  ON customer_simulation_journal_lines(journal_entry_id);

CREATE OR REPLACE FUNCTION validate_customer_simulation_journal_balance() RETURNS TRIGGER AS $$
DECLARE debit_total BIGINT; credit_total BIGINT; currency_count INTEGER;
BEGIN
  SELECT COALESCE(SUM(debit_minor), 0), COALESCE(SUM(credit_minor), 0), COUNT(DISTINCT currency)
    INTO debit_total, credit_total, currency_count
    FROM customer_simulation_journal_lines
   WHERE journal_entry_id = NEW.journal_entry_id;
  IF debit_total <> credit_total OR currency_count <> 1 THEN
    RAISE EXCEPTION 'Unbalanced customer simulation journal entry %', NEW.journal_entry_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_simulation_balance_guard ON customer_simulation_journal_lines;
CREATE CONSTRAINT TRIGGER customer_simulation_balance_guard
AFTER INSERT OR UPDATE ON customer_simulation_journal_lines
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION validate_customer_simulation_journal_balance();

CREATE OR REPLACE FUNCTION prevent_customer_simulation_journal_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Customer simulation journal records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_simulation_lines_immutable ON customer_simulation_journal_lines;
CREATE TRIGGER customer_simulation_lines_immutable
BEFORE UPDATE OR DELETE ON customer_simulation_journal_lines
FOR EACH ROW EXECUTE FUNCTION prevent_customer_simulation_journal_mutation();
DROP TRIGGER IF EXISTS customer_simulation_entries_immutable ON customer_simulation_journal_entries;
CREATE TRIGGER customer_simulation_entries_immutable
BEFORE UPDATE OR DELETE ON customer_simulation_journal_entries
FOR EACH ROW EXECUTE FUNCTION prevent_customer_simulation_journal_mutation();

ALTER TABLE customer_ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_simulation_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_simulation_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_simulation_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_simulation_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE customer_ledger_accounts FROM PUBLIC;
REVOKE ALL ON TABLE customer_simulation_transactions FROM PUBLIC;
REVOKE ALL ON TABLE customer_simulation_journal_entries FROM PUBLIC;
REVOKE ALL ON TABLE customer_simulation_journal_lines FROM PUBLIC;
REVOKE ALL ON TABLE customer_simulation_commands FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION validate_customer_simulation_journal_balance() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION prevent_customer_simulation_journal_mutation() FROM PUBLIC;

INSERT INTO schema_migrations (version)
VALUES ('0030_customer_simulation_ledger')
ON CONFLICT (version) DO NOTHING;
