-- Reconcile the legacy Supabase users.address JSONB column with the
-- canonical application schema, which stores the street address as text.
--
-- The conversion is deliberately idempotent and preserves any pre-existing
-- JSON value as text. JSON string values are unwrapped; objects and arrays are
-- retained as their JSON representation instead of being discarded.

DO $$
DECLARE
  current_type text;
  customers_view_definition text;
  customers_view_owner text;
  customers_view_options text[];
  customers_view_comment text;
  customers_view_grants jsonb;
  grant_record record;
BEGIN
  SELECT data_type
    INTO current_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'users'
     AND column_name = 'address';

  IF current_type = 'jsonb' THEN
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
        c.reloptions,
        obj_description(c.oid, 'pg_class')
      INTO
        customers_view_definition,
        customers_view_owner,
        customers_view_options,
        customers_view_comment
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
      ALTER COLUMN address TYPE text
      USING CASE
        WHEN address IS NULL THEN NULL
        WHEN jsonb_typeof(address) = 'string' THEN address #>> '{}'
        ELSE address::text
      END;

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

      IF customers_view_comment IS NOT NULL THEN
        EXECUTE format(
          'COMMENT ON VIEW public.customers IS %L',
          customers_view_comment
        );
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
  END IF;
END $$;
