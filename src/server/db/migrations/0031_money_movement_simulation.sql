-- Provider-neutral payment-rail instruction model. Every row is synthetic and
-- disconnected from live providers, customer money, routing credentials and
-- the authoritative customer ledger.
CREATE TABLE IF NOT EXISTS money_movement_simulation_instructions (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_rail_%'),
  reference TEXT NOT NULL UNIQUE CHECK (reference LIKE 'SYN-RAIL-%'),
  rail TEXT NOT NULL CHECK (rail IN (
    'p2p','ach','wire','rtp','fednow','mobile_check_deposit','direct_deposit',
    'withdrawal','scheduled_payment','recurring_payment','card','bill_pay'
  )),
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound','internal')),
  status TEXT NOT NULL CHECK (status IN (
    'pending_approval','scheduled','queued','processing','settled','returned',
    'failed','cancelled'
  )),
  asset TEXT NOT NULL CHECK (asset IN ('GBP','EUR','USD','CAD','AUD','CHF','BTC','ETH','USDT')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  source_reference TEXT NOT NULL CHECK (source_reference LIKE 'syn_%' OR source_reference LIKE 'sim_%'),
  destination_reference TEXT NOT NULL CHECK (destination_reference LIKE 'syn_%' OR destination_reference LIKE 'sim_%'),
  memo TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ,
  recurrence TEXT CHECK (recurrence IS NULL OR recurrence IN ('daily','weekly','monthly')),
  provider_adapter_state TEXT NOT NULL DEFAULT 'DISCONNECTED' CHECK (provider_adapter_state = 'DISCONNECTED'),
  execution_source TEXT NOT NULL DEFAULT 'SIMULATION' CHECK (execution_source = 'SIMULATION'),
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS money_movement_simulation_events (
  id TEXT PRIMARY KEY CHECK (id LIKE 'syn_rail_event_%'),
  instruction_id TEXT NOT NULL REFERENCES money_movement_simulation_instructions(id) ON DELETE RESTRICT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  request_correlation_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  synthetic BOOLEAN NOT NULL DEFAULT TRUE CHECK (synthetic IS TRUE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS money_movement_simulation_commands (
  actor_scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  action TEXT NOT NULL,
  result_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (actor_scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS money_movement_simulation_status_idx
  ON money_movement_simulation_instructions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS money_movement_simulation_rail_idx
  ON money_movement_simulation_instructions(rail, created_at DESC);
CREATE INDEX IF NOT EXISTS money_movement_simulation_events_instruction_idx
  ON money_movement_simulation_events(instruction_id, created_at);

CREATE OR REPLACE FUNCTION prevent_money_movement_simulation_event_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Money-movement simulation events are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS money_movement_simulation_events_immutable
  ON money_movement_simulation_events;
CREATE TRIGGER money_movement_simulation_events_immutable
BEFORE UPDATE OR DELETE ON money_movement_simulation_events
FOR EACH ROW EXECUTE FUNCTION prevent_money_movement_simulation_event_mutation();

ALTER TABLE money_movement_simulation_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_movement_simulation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_movement_simulation_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE money_movement_simulation_instructions FROM PUBLIC;
REVOKE ALL ON TABLE money_movement_simulation_events FROM PUBLIC;
REVOKE ALL ON TABLE money_movement_simulation_commands FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION prevent_money_movement_simulation_event_mutation() FROM PUBLIC;

INSERT INTO schema_migrations (version)
VALUES ('0031_money_movement_simulation') ON CONFLICT (version) DO NOTHING;
