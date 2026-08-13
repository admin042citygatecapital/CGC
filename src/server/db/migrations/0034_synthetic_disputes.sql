-- Synthetic dispute and payment-error resolution control plane.
-- Financial remediation is restricted to idempotent balanced reversals in the
-- isolated financial sandbox; these records can never unlock live operations.

CREATE TABLE IF NOT EXISTS synthetic_dispute_cases (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_dispute_%'),
  reference TEXT NOT NULL UNIQUE CHECK (reference LIKE 'SYN-DSP-%'),
  case_type TEXT NOT NULL CHECK (case_type IN ('customer_dispute','payment_error')),
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low','medium','high','critical')),
  status TEXT NOT NULL CHECK (status IN ('open','investigating','escalated','remediation_pending','resolved','rejected','closed')) DEFAULT 'open',
  customer_reference TEXT NOT NULL CHECK (customer_reference LIKE 'syn_%'),
  transaction_id TEXT CHECK (transaction_id IS NULL OR transaction_id LIKE 'syn_tx_%'),
  transfer_id TEXT CHECK (transfer_id IS NULL OR transfer_id LIKE 'syn_%'),
  monitoring_alert_id TEXT CHECK (monitoring_alert_id IS NULL OR monitoring_alert_id LIKE 'syn_alert_%'),
  reconciliation_exception_id TEXT CHECK (reconciliation_exception_id IS NULL OR reconciliation_exception_id LIKE 'syn_recon_exception_%'),
  summary TEXT NOT NULL,
  customer_claim TEXT NOT NULL,
  owner TEXT,
  investigation_notes TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  escalated_at TIMESTAMPTZ,
  remediation_type TEXT CHECK (remediation_type IS NULL OR remediation_type IN ('full_refund','full_reversal','no_financial_action')),
  remediation_reason TEXT,
  remediation_transaction_id TEXT CHECK (remediation_transaction_id IS NULL OR remediation_transaction_id LIKE 'syn_tx_%'),
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  checker_note TEXT,
  last_edited_by TEXT NOT NULL,
  case_sha256 TEXT NOT NULL CHECK (case_sha256 ~ '^[a-f0-9]{64}$'),
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS synthetic_dispute_cases_status_due_idx ON synthetic_dispute_cases(status,due_at);

CREATE TABLE IF NOT EXISTS synthetic_dispute_evidence (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_dispute_evidence_%'),
  case_id TEXT NOT NULL REFERENCES synthetic_dispute_cases(id) ON DELETE RESTRICT,
  label TEXT NOT NULL,
  controlled_reference TEXT NOT NULL,
  evidence_sha256 TEXT NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  added_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS synthetic_dispute_evidence_case_idx ON synthetic_dispute_evidence(case_id,created_at);

CREATE TABLE IF NOT EXISTS synthetic_dispute_notifications (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_dispute_notification_%'),
  case_id TEXT NOT NULL REFERENCES synthetic_dispute_cases(id) ON DELETE RESTRICT,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email','letter','phone')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('recorded','queued','sent','failed')) DEFAULT 'recorded',
  provider_reference TEXT,
  recorded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS synthetic_dispute_notifications_case_idx ON synthetic_dispute_notifications(case_id,created_at);

CREATE TABLE IF NOT EXISTS synthetic_dispute_events (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_dispute_event_%'),
  case_id TEXT NOT NULL REFERENCES synthetic_dispute_cases(id) ON DELETE RESTRICT,
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
CREATE INDEX IF NOT EXISTS synthetic_dispute_events_case_idx ON synthetic_dispute_events(case_id,created_at);

CREATE TABLE IF NOT EXISTS synthetic_dispute_exports (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_dispute_export_%'),
  case_id TEXT NOT NULL REFERENCES synthetic_dispute_cases(id) ON DELETE RESTRICT,
  evidence_sha256 TEXT NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  filename TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION reject_synthetic_dispute_immutable_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'synthetic dispute evidence and history are immutable';
END $$;

DROP TRIGGER IF EXISTS synthetic_dispute_evidence_immutable ON synthetic_dispute_evidence;
CREATE TRIGGER synthetic_dispute_evidence_immutable BEFORE UPDATE OR DELETE ON synthetic_dispute_evidence FOR EACH ROW EXECUTE FUNCTION reject_synthetic_dispute_immutable_mutation();
DROP TRIGGER IF EXISTS synthetic_dispute_notifications_immutable ON synthetic_dispute_notifications;
CREATE TRIGGER synthetic_dispute_notifications_immutable BEFORE UPDATE OR DELETE ON synthetic_dispute_notifications FOR EACH ROW EXECUTE FUNCTION reject_synthetic_dispute_immutable_mutation();
DROP TRIGGER IF EXISTS synthetic_dispute_events_immutable ON synthetic_dispute_events;
CREATE TRIGGER synthetic_dispute_events_immutable BEFORE UPDATE OR DELETE ON synthetic_dispute_events FOR EACH ROW EXECUTE FUNCTION reject_synthetic_dispute_immutable_mutation();
DROP TRIGGER IF EXISTS synthetic_dispute_exports_immutable ON synthetic_dispute_exports;
CREATE TRIGGER synthetic_dispute_exports_immutable BEFORE UPDATE OR DELETE ON synthetic_dispute_exports FOR EACH ROW EXECUTE FUNCTION reject_synthetic_dispute_immutable_mutation();

ALTER TABLE synthetic_dispute_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_dispute_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_dispute_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_dispute_exports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON synthetic_dispute_cases,synthetic_dispute_evidence,synthetic_dispute_notifications,synthetic_dispute_events,synthetic_dispute_exports FROM PUBLIC;
