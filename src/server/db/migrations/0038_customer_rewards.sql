-- Provider/admin-authored rewards records. No customer mutation endpoint is
-- provided, preventing customers from minting points or cashback.
CREATE TABLE IF NOT EXISTS customer_reward_accounts (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  points_balance BIGINT NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  cashback_minor BIGINT NOT NULL DEFAULT 0 CHECK (cashback_minor >= 0),
  cashback_currency TEXT NOT NULL DEFAULT 'GBP' REFERENCES platform_currencies(code) ON DELETE RESTRICT,
  membership_tier TEXT NOT NULL DEFAULT 'Member',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_reward_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('earned','pending','redeemed','cashback')),
  points BIGINT NOT NULL DEFAULT 0,
  cashback_minor BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP' REFERENCES platform_currencies(code) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  provider_reference TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_reward_events_user_date_idx
  ON customer_reward_events(user_id, occurred_at DESC);
