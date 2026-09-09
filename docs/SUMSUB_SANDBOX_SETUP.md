# Sumsub sandbox verification

This workflow creates synthetic test applicants only. It does not attach results to customer cases, approve a customer, perform AML screening or enable transfers.

## Server configuration

Set `SUMSUB_MODE=sandbox` and include `sumsub` in `APPROVED_ONBOARDING_PROVIDERS`.
Use credentials created in Sumsub Sandbox for the following dedicated server variables:

```dotenv
SUMSUB_MODE=sandbox
APPROVED_ONBOARDING_PROVIDERS=sumsub
SUMSUB_SANDBOX_APP_TOKEN=
SUMSUB_SANDBOX_SECRET_KEY=
SUMSUB_SANDBOX_LEVEL_NAME=
SUMSUB_SANDBOX_WEBHOOK_SECRET=
```

The webhook secret must contain at least 16 characters. Do not put credentials in Git, browser code or chat. The existing production provider variables are deliberately not used as fallback credentials. The application additionally rejects applicant API responses unless `sandboxMode` is explicitly true.

## Deployment and provider setup

1. Apply `0057_sumsub_sandbox.sql` with the existing `npm run db:migrate` deployment workflow. It creates separate sandbox tables with RLS and an immutable event ledger. It does not modify customer records.
2. Deploy the application and configure a Sumsub Sandbox webhook for `applicantReviewed` at `https://citygate.capital/api/providers/onboarding/webhook/sumsub-sandbox`.
3. Select SHA-256 or SHA-512 HMAC signing and use the same protected value as `SUMSUB_SANDBOX_WEBHOOK_SECRET`.
4. Sign in as SUPER_ADMIN and open KYC & Onboarding. Select **Create sandbox test**, then **Open sandbox verification**. Use Sumsub sample documents only.
5. Complete the sandbox review and select **Refresh test results**. The result should appear on the same `sbx_` test reference. Readiness stays pending until a valid signed completed-review event is persisted for a matched sandbox applicant.

Applicant creation uses a UUID request ID. Retrying a failed request in the same panel recovers the same applicant through its external ID. Reloading the page generates a new request ID. Test records and provider results remain visible after refresh. Verification links expire after 30 minutes and are not stored in the database.

Duplicate callback bodies are acknowledged without another ledger insert. Results are shown by provider event time so late delivery does not replace a newer review. Missing applicant mappings return HTTP 409 for provider retry. Non-review lifecycle events are acknowledged without counting as verification evidence. Raw webhook bodies, documents and verification links are not retained in the sandbox ledger.

The original `/api/providers/onboarding/webhook/sumsub` endpoint continues rejecting sandbox/test evidence regardless of `SUMSUB_MODE`. Point the sandbox webhook at the new path before testing; generic dashboard test payloads without a matching synthetic applicant cannot count as completed verification.

References: [API authentication](https://docs.sumsub.com/reference/authentication), [create applicant](https://docs.sumsub.com/reference/create-applicant), [verification links](https://docs.sumsub.com/reference/generate-websdk-external-link), [Sandbox testing](https://docs.sumsub.com/docs/test-in-sandbox).
