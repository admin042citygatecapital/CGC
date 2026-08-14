-- Customer bill schedules are planning/reminder records only. They do not
-- execute payments, reserve funds, or post ledger entries.
CREATE TABLE IF NOT EXISTS customer_bill_schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payee TEXT NOT NULL,
  category TEXT NOT NULL,
  currency TEXT NOT NULL REFERENCES platform_currencies(code) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  frequency TEXT NOT NULL CHECK (frequency IN ('one_time','weekly','monthly','quarterly','annually')),
  next_due_date DATE NOT NULL,
  reminder_days INTEGER NOT NULL DEFAULT 3 CHECK (reminder_days >= 0 AND reminder_days <= 30),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','paused','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_bill_schedules_user_due_idx
  ON customer_bill_schedules(user_id, next_due_date, updated_at DESC);
