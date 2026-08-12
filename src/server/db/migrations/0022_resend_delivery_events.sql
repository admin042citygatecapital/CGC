-- Append-only metadata ledger for verified Resend delivery events.
-- No email body, recipient, subject, signature, or provider secret is stored.
CREATE TABLE IF NOT EXISTS email_provider_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider = 'resend'),
  message_id TEXT NOT NULL CHECK (length(message_id) BETWEEN 8 AND 200),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sent', 'scheduled', 'delivered', 'delivery_delayed', 'complained',
    'bounced', 'opened', 'clicked', 'failed', 'suppressed'
  )),
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS email_provider_events_message_idx
  ON email_provider_events(message_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS email_provider_events_type_idx
  ON email_provider_events(event_type, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS email_provider_events_provider_id_idx
  ON email_provider_events(provider, id);

CREATE OR REPLACE FUNCTION reject_email_provider_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'email_provider_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_provider_events_immutable ON email_provider_events;
CREATE TRIGGER email_provider_events_immutable BEFORE UPDATE OR DELETE ON email_provider_events
FOR EACH ROW EXECUTE FUNCTION reject_email_provider_event_mutation();
