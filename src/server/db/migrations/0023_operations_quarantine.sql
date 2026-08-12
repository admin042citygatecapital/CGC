-- Recoverable quarantine for clearly synthetic Operations Inbox records.
-- Records are archived, never deleted, and prior state is kept append-only.

CREATE TABLE IF NOT EXISTS operations_quarantine_batches (
  id TEXT PRIMARY KEY,
  backup_filename TEXT NOT NULL,
  backup_sha256 TEXT NOT NULL,
  reason TEXT NOT NULL,
  initiated_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  item_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  restored_at TIMESTAMPTZ,
  restore_approval_reference TEXT,
  CONSTRAINT operations_quarantine_status_check CHECK (status IN ('planned', 'applied', 'restored')),
  CONSTRAINT operations_quarantine_backup_hash_check CHECK (backup_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT operations_quarantine_item_count_check CHECK (item_count > 0),
  CONSTRAINT operations_quarantine_reason_check CHECK (length(reason) BETWEEN 10 AND 1000)
);

CREATE TABLE IF NOT EXISTS operations_quarantine_records (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES operations_quarantine_batches(id),
  operations_item_id TEXT NOT NULL REFERENCES operations_items(id),
  previous_state JSONB NOT NULL,
  snapshot_sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operations_quarantine_snapshot_hash_check CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  UNIQUE (batch_id, operations_item_id)
);

CREATE INDEX IF NOT EXISTS operations_quarantine_records_batch_idx
  ON operations_quarantine_records(batch_id);

DROP TRIGGER IF EXISTS operations_quarantine_records_append_only ON operations_quarantine_records;
CREATE TRIGGER operations_quarantine_records_append_only
BEFORE UPDATE OR DELETE ON operations_quarantine_records
FOR EACH ROW EXECUTE FUNCTION prevent_quarantine_record_mutation();

