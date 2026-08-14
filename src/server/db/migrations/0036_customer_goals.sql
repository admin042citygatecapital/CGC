-- Customer financial goals are planning records only. They never post ledger
-- entries or change an account balance.
CREATE TABLE IF NOT EXISTS customer_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL REFERENCES platform_currencies(code) ON DELETE RESTRICT,
  target_minor BIGINT NOT NULL CHECK (target_minor > 0),
  tracked_minor BIGINT NOT NULL DEFAULT 0 CHECK (tracked_minor >= 0),
  monthly_contribution_minor BIGINT NOT NULL DEFAULT 0 CHECK (monthly_contribution_minor >= 0),
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_goals_user_updated_idx
  ON customer_goals(user_id, updated_at DESC);
