CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  segment JSONB NOT NULL CHECK (jsonb_typeof(segment) = 'object'),
  status TEXT NOT NULL CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,
  stats JSONB NOT NULL CHECK (jsonb_typeof(stats) = 'object')
);
CREATE INDEX IF NOT EXISTS newsletter_campaigns_status_idx ON newsletter_campaigns(status, created_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_delivery_log (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('delivered','bounced','failed','pending')),
  sent_at TIMESTAMPTZ NOT NULL,
  error_message TEXT,
  campaign_id TEXT
);
CREATE INDEX IF NOT EXISTS newsletter_delivery_log_sent_idx ON newsletter_delivery_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS newsletter_delivery_log_status_idx ON newsletter_delivery_log(status, sent_at DESC);

CREATE OR REPLACE FUNCTION prevent_newsletter_delivery_log_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'newsletter delivery log is immutable'; END; $$;
DROP TRIGGER IF EXISTS newsletter_delivery_log_immutable ON newsletter_delivery_log;
CREATE TRIGGER newsletter_delivery_log_immutable BEFORE UPDATE OR DELETE ON newsletter_delivery_log
FOR EACH ROW EXECUTE FUNCTION prevent_newsletter_delivery_log_mutation();
