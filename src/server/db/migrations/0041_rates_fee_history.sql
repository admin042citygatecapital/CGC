-- Durable, append-only audit history for customer-facing rate, fee, markup,
-- tier, and withdrawal-limit configuration changes.
CREATE TABLE IF NOT EXISTS rate_fee_history (
  id TEXT PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admin_id TEXT NOT NULL,
  admin_email TEXT,
  section TEXT NOT NULL CHECK (section IN ('rates', 'transfer_fees', 'fx_markup', 'tier_fees', 'limits')),
  field TEXT NOT NULL CHECK (char_length(field) BETWEEN 1 AND 200),
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  ip TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_fee_history_ts_idx ON rate_fee_history(ts DESC);
CREATE INDEX IF NOT EXISTS rate_fee_history_section_idx ON rate_fee_history(section, ts DESC);
CREATE INDEX IF NOT EXISTS rate_fee_history_admin_idx ON rate_fee_history(admin_id, ts DESC);

CREATE OR REPLACE FUNCTION prevent_rate_fee_history_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'rate and fee history is immutable';
END;
$$;

DROP TRIGGER IF EXISTS rate_fee_history_immutable ON rate_fee_history;
CREATE TRIGGER rate_fee_history_immutable
  BEFORE UPDATE OR DELETE ON rate_fee_history
  FOR EACH ROW EXECUTE FUNCTION prevent_rate_fee_history_mutation();
