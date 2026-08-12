-- Reversible quarantine controls for test identities and their synthetic records.
-- Nothing is deleted. Every changed field has an append-only prior-state snapshot.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS data_classification TEXT NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS quarantine_batch_id TEXT,
  ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS data_classification TEXT NOT NULL DEFAULT 'application_record',
  ADD COLUMN IF NOT EXISTS quarantine_batch_id TEXT;

CREATE TABLE IF NOT EXISTS data_quarantine_batches (
  id TEXT PRIMARY KEY,
  provider_backup_reference TEXT NOT NULL,
  provider_backup_verified_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  initiated_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  customer_count INTEGER NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  restored_at TIMESTAMPTZ,
  restore_approval_reference TEXT,
  CONSTRAINT data_quarantine_batch_status_check CHECK (status IN ('planned', 'applied', 'restored')),
  CONSTRAINT data_quarantine_backup_reference_check CHECK (length(provider_backup_reference) BETWEEN 6 AND 200),
  CONSTRAINT data_quarantine_reason_check CHECK (length(reason) BETWEEN 10 AND 1000)
);

CREATE TABLE IF NOT EXISTS data_quarantine_records (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES data_quarantine_batches(id),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  previous_state JSONB NOT NULL,
  snapshot_sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT data_quarantine_resource_type_check CHECK (resource_type IN ('user', 'transaction')),
  CONSTRAINT data_quarantine_snapshot_hash_check CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  UNIQUE (batch_id, resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS users_data_classification_idx ON users(data_classification);
CREATE INDEX IF NOT EXISTS users_quarantine_batch_idx ON users(quarantine_batch_id);
CREATE INDEX IF NOT EXISTS transactions_data_classification_idx ON transactions(data_classification);
CREATE INDEX IF NOT EXISTS transactions_quarantine_batch_idx ON transactions(quarantine_batch_id);
CREATE INDEX IF NOT EXISTS data_quarantine_records_batch_idx ON data_quarantine_records(batch_id);

CREATE OR REPLACE FUNCTION prevent_quarantine_record_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'data quarantine snapshots are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS data_quarantine_records_append_only ON data_quarantine_records;
CREATE TRIGGER data_quarantine_records_append_only
BEFORE UPDATE OR DELETE ON data_quarantine_records
FOR EACH ROW EXECUTE FUNCTION prevent_quarantine_record_mutation();
