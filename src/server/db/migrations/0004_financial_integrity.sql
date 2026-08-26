-- Core monetary values use fixed-precision decimals, and customer-initiated
-- financial writes carry a per-user idempotency key and request fingerprint.

-- PostgreSQL will not alter a column while a view depends on it. Some legacy
-- databases already expose public.customers as a compatibility view over
-- public.users, so preserve and restore that view transactionally around the
-- canonical balance precision change. A failed recreation aborts the whole
-- migration, leaving both the column and view unchanged.
DO $$
DECLARE
  customers_view_definition TEXT;
  customers_view_owner TEXT;
  customers_view_options TEXT[];
  customers_view_grants JSONB;
  grant_record RECORD;
BEGIN
  IF to_regclass('public.customers') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM pg_class
       WHERE oid = 'public.customers'::regclass
         AND relkind = 'v'
     ) THEN
    SELECT
      pg_get_viewdef(c.oid, true),
      pg_get_userbyid(c.relowner),
      c.reloptions
    INTO
      customers_view_definition,
      customers_view_owner,
      customers_view_options
    FROM pg_class c
    WHERE c.oid = 'public.customers'::regclass;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'grantee', grantee,
          'privilege_type', privilege_type,
          'is_grantable', is_grantable
        )
        ORDER BY grantee, privilege_type
      ),
      '[]'::jsonb
    )
    INTO customers_view_grants
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'customers';

    DROP VIEW public.customers;
  END IF;

  ALTER TABLE public.users
    ALTER COLUMN balance TYPE NUMERIC(20, 2)
    USING ROUND(COALESCE(balance, 0)::numeric, 2);

  IF customers_view_definition IS NOT NULL THEN
    EXECUTE format('CREATE VIEW public.customers AS %s', customers_view_definition);
    EXECUTE format('ALTER VIEW public.customers OWNER TO %I', customers_view_owner);

    IF customers_view_options IS NOT NULL THEN
      IF 'security_invoker=true' = ANY(customers_view_options) THEN
        ALTER VIEW public.customers SET (security_invoker = true);
      END IF;
      IF 'security_barrier=true' = ANY(customers_view_options) THEN
        ALTER VIEW public.customers SET (security_barrier = true);
      END IF;
    END IF;

    FOR grant_record IN
      SELECT
        value->>'grantee' AS grantee,
        value->>'privilege_type' AS privilege_type,
        value->>'is_grantable' AS is_grantable
      FROM jsonb_array_elements(customers_view_grants)
    LOOP
      IF grant_record.grantee <> customers_view_owner THEN
        EXECUTE format(
          'GRANT %s ON TABLE public.customers TO %I%s',
          grant_record.privilege_type,
          grant_record.grantee,
          CASE
            WHEN grant_record.is_grantable = 'YES' THEN ' WITH GRANT OPTION'
            ELSE ''
          END
        );
      END IF;
    END LOOP;
  END IF;
END
$$;

ALTER TABLE transactions
  ALTER COLUMN amount TYPE NUMERIC(30, 8)
  USING ROUND(amount::numeric, 8);

ALTER TABLE cards
  ALTER COLUMN spending_limit TYPE NUMERIC(20, 2)
  USING ROUND(spending_limit::numeric, 2);

ALTER TABLE card_activity
  ALTER COLUMN amount TYPE NUMERIC(20, 2)
  USING ROUND(amount::numeric, 2);

ALTER TABLE wallets
  ALTER COLUMN min_deposit TYPE NUMERIC(30, 8)
  USING ROUND(min_deposit::numeric, 8);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS idempotency_fingerprint TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_idempotency_idx
  ON transactions (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
