-- Durable, concurrent administration queue for customer/public submissions.
-- The unique source/reference key makes imports and request retries idempotent.

CREATE TABLE IF NOT EXISTS operations_items (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  requester_name TEXT,
  requester_email TEXT,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_review', 'waiting_customer', 'approved', 'rejected', 'resolved', 'archived')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to TEXT,
  admin_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operations_items_source_reference_unique UNIQUE (source, reference_id)
);

CREATE INDEX IF NOT EXISTS operations_items_status_updated_idx
  ON operations_items (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS operations_items_priority_idx
  ON operations_items (priority);
CREATE INDEX IF NOT EXISTS operations_items_requester_email_idx
  ON operations_items (requester_email);
CREATE INDEX IF NOT EXISTS operations_items_user_id_idx
  ON operations_items (user_id);
