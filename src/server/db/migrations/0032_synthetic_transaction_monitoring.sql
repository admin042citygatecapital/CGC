-- Synthetic transaction monitoring. This subsystem accepts only syn_ records
-- and cannot alter a customer balance, file a report or call a provider.
CREATE TABLE IF NOT EXISTS synthetic_monitoring_alerts (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_alert_%'),
  reference TEXT NOT NULL UNIQUE CHECK (reference LIKE 'SYN-ALERT-%'),
  fingerprint TEXT NOT NULL UNIQUE,
  rule_key TEXT NOT NULL CHECK (rule_key IN ('velocity_count','velocity_amount','rapid_movement','unusual_asset','manual_review')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','escalated','resolution_pending','closed_false_positive','closed_case')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  subject_reference TEXT NOT NULL CHECK (subject_reference LIKE 'syn_%' OR subject_reference LIKE 'sim_%'),
  summary TEXT NOT NULL,
  detection_window_start TIMESTAMPTZ NOT NULL,
  detection_window_end TIMESTAMPTZ NOT NULL,
  transaction_count INTEGER NOT NULL CHECK (transaction_count > 0),
  aggregate_amount_minor NUMERIC(30,0) NOT NULL CHECK (aggregate_amount_minor >= 0),
  asset TEXT NOT NULL,
  case_id TEXT,
  proposed_resolution TEXT,
  resolution TEXT,
  generated_by TEXT NOT NULL,
  last_edited_by TEXT NOT NULL,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (detection_window_end >= detection_window_start)
);
CREATE INDEX IF NOT EXISTS synthetic_monitoring_alerts_queue_idx ON synthetic_monitoring_alerts(status, risk_level, created_at DESC);
CREATE INDEX IF NOT EXISTS synthetic_monitoring_alerts_subject_idx ON synthetic_monitoring_alerts(subject_reference, created_at DESC);

CREATE TABLE IF NOT EXISTS synthetic_monitoring_alert_transactions (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_alert_link_%'),
  alert_id TEXT NOT NULL REFERENCES synthetic_monitoring_alerts(id) ON DELETE RESTRICT,
  transaction_id TEXT NOT NULL CHECK (transaction_id LIKE 'syn_%'),
  transaction_reference TEXT NOT NULL CHECK (transaction_reference LIKE 'SYN-%'),
  transaction_source TEXT NOT NULL CHECK (transaction_source IN ('financial_sandbox','money_movement_simulation','customer_simulation')),
  amount_minor NUMERIC(30,0) NOT NULL CHECK (amount_minor >= 0),
  asset TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  snapshot_sha256 TEXT NOT NULL CHECK (snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(alert_id, transaction_source, transaction_id)
);
CREATE INDEX IF NOT EXISTS synthetic_monitoring_links_alert_idx ON synthetic_monitoring_alert_transactions(alert_id, occurred_at);

CREATE TABLE IF NOT EXISTS synthetic_monitoring_alert_events (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_alert_event_%'),
  alert_id TEXT NOT NULL REFERENCES synthetic_monitoring_alerts(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system','admin','independent_checker')),
  from_status TEXT,
  to_status TEXT NOT NULL,
  rationale TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS synthetic_monitoring_events_alert_idx ON synthetic_monitoring_alert_events(alert_id, created_at);

-- Keep this migration self-contained. Some installations do not include the
-- earlier onboarding event helper, so monitoring owns its immutable trigger.
CREATE OR REPLACE FUNCTION reject_synthetic_monitoring_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'synthetic monitoring history is immutable';
END $$;

DROP TRIGGER IF EXISTS synthetic_monitoring_events_immutable ON synthetic_monitoring_alert_events;
CREATE TRIGGER synthetic_monitoring_events_immutable BEFORE UPDATE OR DELETE ON synthetic_monitoring_alert_events
FOR EACH ROW EXECUTE FUNCTION reject_synthetic_monitoring_history_mutation();
DROP TRIGGER IF EXISTS synthetic_monitoring_links_immutable ON synthetic_monitoring_alert_transactions;
CREATE TRIGGER synthetic_monitoring_links_immutable BEFORE UPDATE OR DELETE ON synthetic_monitoring_alert_transactions
FOR EACH ROW EXECUTE FUNCTION reject_synthetic_monitoring_history_mutation();
