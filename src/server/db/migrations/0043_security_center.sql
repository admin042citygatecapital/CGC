CREATE TABLE IF NOT EXISTS security_center_alerts (
  id TEXT PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'brute_force','ip_blocked','session_hijack','unusual_admin_activity','mass_login_failure',
    'rate_limit_exceeded','new_admin_login','config_change','permission_change','manual'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  ip TEXT,
  user_id TEXT,
  admin_id TEXT,
  event_count INTEGER CHECK (event_count IS NULL OR event_count >= 0),
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(meta) = 'object'),
  CHECK ((resolved = FALSE AND resolved_at IS NULL AND resolved_by IS NULL) OR
         (resolved = TRUE AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS security_center_alerts_ts_idx ON security_center_alerts(ts DESC);
CREATE INDEX IF NOT EXISTS security_center_alerts_open_idx ON security_center_alerts(resolved, severity, ts DESC);
