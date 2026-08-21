CREATE TABLE IF NOT EXISTS admin_notification_dispatches (
  id text PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('customer','security','maintenance','service','support')),
  target_type text NOT NULL CHECK (target_type IN ('customer','group','all')),
  target_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','partial','failed')),
  created_by text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  delivered_count integer NOT NULL DEFAULT 0 CHECK (delivered_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS admin_notification_deliveries (
  id text PRIMARY KEY,
  dispatch_id text NOT NULL REFERENCES admin_notification_dispatches(id) ON DELETE RESTRICT,
  user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notification_id text REFERENCES notifications(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('delivered','failed')),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dispatch_id, user_id)
);

CREATE INDEX IF NOT EXISTS admin_notification_dispatches_created_at_idx ON admin_notification_dispatches(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_notification_deliveries_dispatch_idx ON admin_notification_deliveries(dispatch_id);
CREATE INDEX IF NOT EXISTS admin_notification_deliveries_user_idx ON admin_notification_deliveries(user_id, created_at DESC);

ALTER TABLE admin_notification_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notification_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_notification_dispatches FROM PUBLIC;
REVOKE ALL ON admin_notification_deliveries FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON admin_notification_dispatches FROM anon';
    EXECUTE 'REVOKE ALL ON admin_notification_deliveries FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON admin_notification_dispatches FROM authenticated';
    EXECUTE 'REVOKE ALL ON admin_notification_deliveries FROM authenticated';
  END IF;
END $$;
