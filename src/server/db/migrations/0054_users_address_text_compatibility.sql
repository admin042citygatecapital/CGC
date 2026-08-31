-- Reconcile the legacy Supabase users.address JSONB column with the
-- canonical application schema, which stores the street address as text.
--
-- The conversion is deliberately idempotent and preserves any pre-existing
-- JSON value as text. JSON string values are unwrapped; objects and arrays are
-- retained as their JSON representation instead of being discarded.

DO $$
DECLARE
  current_type text;
BEGIN
  SELECT data_type
    INTO current_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'users'
     AND column_name = 'address';

  IF current_type = 'jsonb' THEN
    ALTER TABLE public.users
      ALTER COLUMN address TYPE text
      USING CASE
        WHEN address IS NULL THEN NULL
        WHEN jsonb_typeof(address) = 'string' THEN address #>> '{}'
        ELSE address::text
      END;
  END IF;
END $$;
