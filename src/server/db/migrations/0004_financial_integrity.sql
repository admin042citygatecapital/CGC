-- Core monetary values use fixed-precision decimals, and customer-initiated
-- financial writes carry a per-user idempotency key and request fingerprint.

ALTER TABLE users
  ALTER COLUMN balance TYPE NUMERIC(20, 2)
  USING ROUND(COALESCE(balance, 0)::numeric, 2);

ALTER TABLE transactions
  ALTER COLUMN amount TYPE NUMERIC(30, 8)
  USING ROUND(amount::numeric, 8);

ALTER TABLE cards
  ALTER COLUMN spending_limit TYPE NUMERIC(20, 2)
  USING ROUND(spending_limit::numeric, 2);

ALTER TABLE card_activity
  ALTER COLUMN amount TYPE NUMERIC(20, 2)
  USING ROUND(amount::numeric, 2);

ALTER TABLE wallets
  ALTER COLUMN min_deposit TYPE NUMERIC(30, 8)
  USING ROUND(min_deposit::numeric, 8);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS idempotency_fingerprint TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_idempotency_idx
  ON transactions (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
