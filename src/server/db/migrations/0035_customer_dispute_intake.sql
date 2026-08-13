-- Authenticated customer intake for the existing dispute control plane.
-- Customer identity is resolved by the server session and never accepted from
-- request JSON. Internal investigation data remains administration-only.

ALTER TABLE synthetic_dispute_cases
  ADD COLUMN IF NOT EXISTS customer_user_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS synthetic_dispute_customer_idempotency_idx
  ON synthetic_dispute_cases(customer_user_id, customer_idempotency_key)
  WHERE customer_user_id IS NOT NULL AND customer_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS synthetic_dispute_customer_updated_idx
  ON synthetic_dispute_cases(customer_user_id, updated_at DESC)
  WHERE customer_user_id IS NOT NULL;

ALTER TABLE synthetic_dispute_cases
  DROP CONSTRAINT IF EXISTS synthetic_dispute_cases_transaction_id_check;

ALTER TABLE synthetic_dispute_cases
  ADD CONSTRAINT synthetic_dispute_cases_transaction_id_check
  CHECK (transaction_id IS NULL OR transaction_id ~ '^(syn_tx_|tx_)[A-Za-z0-9_-]+$');

ALTER TABLE synthetic_dispute_events
  DROP CONSTRAINT IF EXISTS synthetic_dispute_events_actor_type_check;

ALTER TABLE synthetic_dispute_events
  ADD CONSTRAINT synthetic_dispute_events_actor_type_check
  CHECK (actor_type IN ('admin','independent_checker','system','customer'));
