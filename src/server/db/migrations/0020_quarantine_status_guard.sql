-- A quarantined test identity must remain suspended until the audited restore
-- workflow clears its quarantine metadata. This also repairs any status drift
-- that occurred before the database-level invariant existed.

UPDATE users
SET status = 'suspended', updated_at = NOW()
WHERE (data_classification = 'quarantined_test' OR quarantine_batch_id IS NOT NULL)
  AND status IS DISTINCT FROM 'suspended';

CREATE OR REPLACE FUNCTION enforce_quarantined_user_suspension()
RETURNS trigger AS $$
BEGIN
  IF OLD.data_classification = 'quarantined_test'
     AND (NEW.data_classification = 'quarantined_test' OR NEW.quarantine_batch_id IS NOT NULL)
     AND NEW.status IS DISTINCT FROM 'suspended' THEN
    NEW.status := 'suspended';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_quarantine_status_guard ON users;
CREATE TRIGGER users_quarantine_status_guard
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION enforce_quarantined_user_suspension();
