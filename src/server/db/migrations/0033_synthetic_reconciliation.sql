-- Synthetic daily three-way reconciliation and maker-checker exception control.
-- This schema is deliberately isolated from customer and live-provider tables.

CREATE TABLE IF NOT EXISTS synthetic_reconciliation_runs (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_recon_run_%'),
  reference TEXT NOT NULL UNIQUE CHECK (reference LIKE 'SYN-RECON-%'),
  business_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'completed_with_breaks')),
  transaction_count INTEGER NOT NULL CHECK (transaction_count >= 0),
  provider_instruction_count INTEGER NOT NULL CHECK (provider_instruction_count >= 0),
  journal_entry_count INTEGER NOT NULL CHECK (journal_entry_count >= 0),
  matched_count INTEGER NOT NULL CHECK (matched_count >= 0),
  exception_count INTEGER NOT NULL CHECK (exception_count >= 0),
  matched_amount_minor NUMERIC(30,0) NOT NULL DEFAULT 0 CHECK (matched_amount_minor >= 0),
  snapshot_sha256 TEXT NOT NULL CHECK (snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  generated_by TEXT NOT NULL,
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS synthetic_reconciliation_items (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_recon_item_%'),
  run_id TEXT NOT NULL REFERENCES synthetic_reconciliation_runs(id) ON DELETE RESTRICT,
  outcome TEXT NOT NULL CHECK (outcome IN ('matched','missing_transaction','missing_provider_instruction','missing_journal','duplicate_reference','amount_mismatch','asset_mismatch','unbalanced_journal')),
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  provider_instruction_id TEXT,
  transaction_id TEXT,
  transaction_reference TEXT,
  journal_entry_reference TEXT,
  asset TEXT,
  amount_minor NUMERIC(30,0),
  snapshot_sha256 TEXT NOT NULL CHECK (snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS synthetic_reconciliation_items_run_idx ON synthetic_reconciliation_items(run_id, outcome);

CREATE TABLE IF NOT EXISTS synthetic_reconciliation_exceptions (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_recon_exception_%'),
  item_id TEXT NOT NULL UNIQUE REFERENCES synthetic_reconciliation_items(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('open','investigating','escalated','resolution_pending','resolved','accepted_risk')) DEFAULT 'open',
  owner TEXT,
  investigation_notes TEXT,
  proposed_resolution TEXT,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  last_edited_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS synthetic_reconciliation_exceptions_status_idx ON synthetic_reconciliation_exceptions(status, updated_at);

CREATE TABLE IF NOT EXISTS synthetic_reconciliation_events (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_recon_event_%'),
  exception_id TEXT NOT NULL REFERENCES synthetic_reconciliation_exceptions(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin','independent_checker','system')),
  from_status TEXT,
  to_status TEXT NOT NULL,
  rationale TEXT NOT NULL,
  request_correlation_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS synthetic_reconciliation_events_exception_idx ON synthetic_reconciliation_events(exception_id, created_at);

CREATE TABLE IF NOT EXISTS synthetic_reconciliation_exports (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_recon_export_%'),
  run_id TEXT NOT NULL REFERENCES synthetic_reconciliation_runs(id) ON DELETE RESTRICT,
  evidence_sha256 TEXT NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  filename TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION reject_synthetic_reconciliation_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'synthetic reconciliation snapshots are immutable';
END $$;

DROP TRIGGER IF EXISTS synthetic_reconciliation_runs_immutable ON synthetic_reconciliation_runs;
CREATE TRIGGER synthetic_reconciliation_runs_immutable BEFORE UPDATE OR DELETE ON synthetic_reconciliation_runs FOR EACH ROW EXECUTE FUNCTION reject_synthetic_reconciliation_snapshot_mutation();
DROP TRIGGER IF EXISTS synthetic_reconciliation_items_immutable ON synthetic_reconciliation_items;
CREATE TRIGGER synthetic_reconciliation_items_immutable BEFORE UPDATE OR DELETE ON synthetic_reconciliation_items FOR EACH ROW EXECUTE FUNCTION reject_synthetic_reconciliation_snapshot_mutation();
DROP TRIGGER IF EXISTS synthetic_reconciliation_events_immutable ON synthetic_reconciliation_events;
CREATE TRIGGER synthetic_reconciliation_events_immutable BEFORE UPDATE OR DELETE ON synthetic_reconciliation_events FOR EACH ROW EXECUTE FUNCTION reject_synthetic_reconciliation_snapshot_mutation();
DROP TRIGGER IF EXISTS synthetic_reconciliation_exports_immutable ON synthetic_reconciliation_exports;
CREATE TRIGGER synthetic_reconciliation_exports_immutable BEFORE UPDATE OR DELETE ON synthetic_reconciliation_exports FOR EACH ROW EXECUTE FUNCTION reject_synthetic_reconciliation_snapshot_mutation();

ALTER TABLE synthetic_reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_reconciliation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_reconciliation_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_reconciliation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_reconciliation_exports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON synthetic_reconciliation_runs, synthetic_reconciliation_items, synthetic_reconciliation_exceptions, synthetic_reconciliation_events, synthetic_reconciliation_exports FROM PUBLIC;
