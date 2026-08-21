ALTER TABLE admin_notification_dispatches
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS request_fingerprint text;

UPDATE admin_notification_dispatches
   SET idempotency_key = COALESCE(idempotency_key, 'legacy:' || id),
       request_fingerprint = COALESCE(request_fingerprint, 'legacy:' || id)
 WHERE idempotency_key IS NULL OR request_fingerprint IS NULL;

ALTER TABLE admin_notification_dispatches
  ALTER COLUMN idempotency_key SET NOT NULL,
  ALTER COLUMN request_fingerprint SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_notification_dispatches_idempotency_key_uidx
  ON admin_notification_dispatches(idempotency_key);
