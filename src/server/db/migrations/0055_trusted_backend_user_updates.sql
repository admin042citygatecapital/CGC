-- Keep privileged user fields protected from browser/PostgREST updates while
-- permitting the trusted Render server's direct PostgreSQL connection to run
-- the already-authorized account lifecycle operations implemented in Express.
--
-- Supabase API requests execute through the authenticator role and must still
-- satisfy the service_role JWT check. The current Render DATABASE_URL connects
-- directly as postgres; a future dedicated application role should replace it.

CREATE OR REPLACE FUNCTION public.guard_users_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR session_user = 'postgres' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed to change id';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Not allowed to change created_at';
  END IF;
  IF NEW.balance IS DISTINCT FROM OLD.balance
     OR NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION 'Not allowed to change balance/currency directly';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Not allowed to change account status';
  END IF;
  IF NEW.account_tier IS DISTINCT FROM OLD.account_tier THEN
    RAISE EXCEPTION 'Not allowed to change account tier';
  END IF;
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     OR NEW.kyc_submitted_at IS DISTINCT FROM OLD.kyc_submitted_at
     OR NEW.kyc_approved_at IS DISTINCT FROM OLD.kyc_approved_at
     OR NEW.kyc_expires_at IS DISTINCT FROM OLD.kyc_expires_at
     OR NEW.kyc_document_type IS DISTINCT FROM OLD.kyc_document_type
     OR NEW.kyc_document_number IS DISTINCT FROM OLD.kyc_document_number
     OR NEW.kyc_document_url IS DISTINCT FROM OLD.kyc_document_url
     OR NEW.kyc_selfie_url IS DISTINCT FROM OLD.kyc_selfie_url
     OR NEW.kyc_rejection_reason IS DISTINCT FROM OLD.kyc_rejection_reason THEN
    RAISE EXCEPTION 'Not allowed to change KYC fields directly';
  END IF;
  IF NEW.email_verified IS DISTINCT FROM OLD.email_verified THEN
    RAISE EXCEPTION 'Not allowed to change email_verified directly';
  END IF;
  IF NEW.two_fa_enabled IS DISTINCT FROM OLD.two_fa_enabled
     OR NEW.two_fa_secret IS DISTINCT FROM OLD.two_fa_secret THEN
    RAISE EXCEPTION 'Not allowed to change 2FA fields directly; use a verified enrollment flow';
  END IF;
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    RAISE EXCEPTION 'Not allowed to change password_hash directly';
  END IF;
  IF NEW.verify_token IS DISTINCT FROM OLD.verify_token
     OR NEW.verify_token_expires_at IS DISTINCT FROM OLD.verify_token_expires_at
     OR NEW.session_token IS DISTINCT FROM OLD.session_token
     OR NEW.session_token_expires_at IS DISTINCT FROM OLD.session_token_expires_at
     OR NEW.password_reset_token IS DISTINCT FROM OLD.password_reset_token
     OR NEW.password_reset_expires_at IS DISTINCT FROM OLD.password_reset_expires_at THEN
    RAISE EXCEPTION 'Not allowed to change auth token fields directly';
  END IF;
  IF NEW.last_login_at IS DISTINCT FROM OLD.last_login_at
     OR NEW.last_login_ip IS DISTINCT FROM OLD.last_login_ip
     OR NEW.login_count IS DISTINCT FROM OLD.login_count
     OR NEW.failed_login_count IS DISTINCT FROM OLD.failed_login_count
     OR NEW.last_failed_login_at IS DISTINCT FROM OLD.last_failed_login_at
     OR NEW.locked_until IS DISTINCT FROM OLD.locked_until THEN
    RAISE EXCEPTION 'Not allowed to change login/security telemetry fields directly';
  END IF;
  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
     OR NEW.rejected_by IS DISTINCT FROM OLD.rejected_by
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION 'Not allowed to change admin decision fields directly';
  END IF;
  IF NEW.registration_ip IS DISTINCT FROM OLD.registration_ip THEN
    RAISE EXCEPTION 'Not allowed to change registration_ip';
  END IF;
  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN
    RAISE EXCEPTION 'Not allowed to change referral fields directly';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.guard_users_privileged_columns() IS
  'Protects privileged users fields from Supabase API clients while allowing service-role and trusted direct backend updates.';
