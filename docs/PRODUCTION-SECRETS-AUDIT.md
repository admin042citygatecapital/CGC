# Production secrets audit — checklist

Generated from `src/server/lib/envValidator.ts` (62 validated variables), 2026-09-11,
release `a438485`.

**Remote verification is intentionally impossible from here:** secret coverage is
admin-only by design (`src/server/api/health/GET.ts` exposes only required
components). The authoritative check is the server's own startup validation —
on every boot it emits `env.validation.warning` / `env.validation.critical`
events naming exactly which variables are missing on the running instance.

**Practical audit path:** Render dashboard → the service → Logs → filter for
`env.validation` on the most recent deploy. Anything listed there is missing or
malformed in production; everything else in this checklist is configured.

## CRITICAL (deployment-blocking when missing)

| Variable | Service | Note |
|---|---|---|
| `DATABASE_URL` | Database | Verified live: PostgreSQL responds (~4 ms) |
| `APP_URL` | Application / SEO | Public base URL |
| `CARD_ENCRYPTION_KEY` | Card Data Encryption | 64-hex; AES-256-GCM for PAN/CVV |
| `RESEND_API_KEY` | Resend Email Delivery | CRITICAL level; mail falls back to Zoho/manual SMTP |
| `ADMIN_PASSWORD_HASH` (prod level CRITICAL) | Admin Authentication | Dev-only fallback; production admin credentials are database-backed |

Live status as of deploy: api / database / storage / sessions all healthy, so
the CRITICAL core is configured on the running instance.

## WARNING level (feature-degrading when missing, not blocking)

| Variable | Service | Effect when missing |
|---|---|---|
| `SPONSOR_REVIEWER_EMAIL` | Independent Sponsor Review | Independent reviewer identity absent |
| `SPONSOR_REVIEWER_KEY_HASH` | Independent Sponsor Review | Reviewer credential auth disabled (64-hex SHA-256) |
| `JWT_SECRET` | Session Management / JWT | Alias for `SESSION_SECRET` — only a warning if neither is set |
| `KYC_FIELD_ENCRYPTION_KEY` | Private KYC Onboarding | **KYC profile submission fails closed** (identity-document numbers cannot be encrypted); 64-hex |

The e2e harness intentionally strips secrets, so warnings seen in test logs are
expected there — do not infer production state from them.

## INFO level (optional integrations; absence is by-design while the platform is in preview)

- **Email:** Zoho OAuth (`ZOHO_CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN/ACCOUNT_ID`),
  `RESEND_WEBHOOK_SIGNING_SECRET`, `MAIL_PASSWORD` (manual SMTP fallback)
- **Financial Launch Gate (18 vars):** provider/approval attestations —
  `LIVE_COMPLIANCE_APPROVAL_ID`, `KYC_PROVIDER`, `AML_SCREENING_PROVIDER`,
  `PAYMENT_PROVIDER`, `CUSTODY_PROVIDER`, `TARGET_LAUNCH_JURISDICTION`,
  `LEGAL_ENTITY_REGISTRATION`, `REGULATORY_COUNSEL_APPROVAL_ID`,
  `SPONSOR_FINANCIAL_INSTITUTION`, `PROGRAM_PROVIDER`,
  `PROVIDER_CONTRACTS_APPROVAL_ID`, `SANCTIONS_SCREENING_PROVIDER`,
  `TRANSACTION_MONITORING_PROVIDER`, `LEDGER_PROVIDER`,
  `RECONCILIATION_CONTROL_ID`, `CARD_ISSUER_PROCESSOR`, `COMPLIANCE_OFFICER`,
  `CUSTOMER_DISCLOSURE_APPROVAL_ID`, `SECURITY_PENTEST_REPORT_ID`,
  `INCIDENT_RESPONSE_APPROVAL_ID`, `DATA_RETENTION_APPROVAL_ID`
  (deliberately unset: the platform is sandbox-scoped with financial execution off)
- **Admin panel / API client:** `ADMIN_URL`, `API_BASE_URL`
- **Support / analytics / maps:** `TAWK_PROPERTY_ID`, `TAWK_WIDGET_ID`,
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `GA_MEASUREMENT_ID`,
  `GA_API_SECRET`, `GTM_CONTAINER_ID`, `GOOGLE_MAPS_API_KEY`
- **Payments:** Stripe (`STRIPE_SECRET_KEY/PUBLISHABLE_KEY/WEBHOOK_SECRET`),
  PayPal (`PAYPAL_CLIENT_ID/CLIENT_SECRET`)
- **Messaging:** Twilio (`TWILIO_ACCOUNT_SID/AUTH_TOKEN/VERIFY_SID`),
  WhatsApp (`WHATSAPP_TOKEN/WHATSAPP_PHONE_ID`)
- **Banking APIs:** `FLUTTERWAVE_SECRET_KEY`, `PAYSTACK_SECRET_KEY`,
  `BANKING_API_KEY`
- **Admin emergency unlock:** `ADMIN_UNLOCK_KEY`

## Decision needed (owner action, not code)

1. Run the log filter above and record any `env.validation` lines for the
   current release.
2. For each flagged WARNING var: configure it in Render → Environment, or
   record an explicit accepted-gap note here (e.g. "no independent sponsor
   reviewer appointed yet").
3. Re-run after configuring: the boot log should show a clean validation
   pass; confirm with a fresh deploy and this file updated.