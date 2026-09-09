# City Gate Capital — Production Readiness Report

Generated: 2026-08-04

## Summary

The app is connected to a live Supabase Postgres database, all schema migrations are applied, and the full validation suite (lint / typecheck / build / test) passes cleanly. Registration was verified end-to-end against the real database via the browser UI. Two items below need your input before a production deploy: the npm audit finding and confirming your Vercel env vars.

## Database — Supabase Postgres

- **Project:** `cckajgyylpglabloojsv` (region `eu-west-1`)
- **Connection:** direct `postgresql://` connection on port 5432 via the `postgres` (postgres.js) driver — no PgBouncer pooler needed for this driver, unlike the old Neon HTTP driver this app originally shipped with
- **Schema:** all 3 migrations applied (`0001_initial_schema`, `0002_access_log_brute_force`, `0003_supabase_compat`) — 26 tables live
- **Row Level Security:** enabled on all 26 tables (no policies). This is safe for the app's current access pattern — Drizzle connects as the `postgres` role, which bypasses RLS as table owner — and closes off the anon/publishable key from reading or writing any table via Supabase's REST API (PostgREST), which had been fully exposed before. If you later want the browser Supabase client to query tables directly (rather than through the app's own API), you'll need to add explicit policies for that.
- **Verified live:** registered a test account through the actual `/register` UI and confirmed the row landed correctly in Postgres, then removed it.

### Bug found and fixed during verification

`detectDuplicate()` in [userStore.ts](src/server/lib/userStore.ts) passed a native JS `Date` object into a raw Drizzle `sql` template for a duplicate-registration IP check. Drizzle's raw-template bind path (unlike postgres.js's own tagged template) doesn't serialize `Date` objects, so every registration attempt crashed with an unhandled `TypeError` — surfaced to users as "Internal server error." Fixed by converting to `.toISOString()` before binding. No other raw `sql` templates in the codebase carry this pattern.

## Validation results

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 97 warnings (pre-existing `any` types / minor hook-dependency warnings — no functional issues) |
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | Client + SSR bundles both build successfully |
| `npm test` | 40/40 tests passing (4 files) |

## Outstanding item — npm audit

```
react-router  7.12.0 - 8.2.0   (installed: 7.18.2)
Severity: high
RSC Mode CSRF Bypass Allows Action Execution Before 400 Response
```

The only automatic fix (`npm audit fix --force`) downgrades to `react-router-dom@7.11.0`, a breaking change. This app doesn't use React Router's RSC/framework "Server Actions" mode — it's a custom Express + Vite SSR setup using `createBrowserRouter` for client-side routing only, with no `loader`/`action` route definitions — so the specific exploit path (CSRF against server actions) likely doesn't apply here. Flagging rather than auto-downgrading since I can't fully verify exploitability without React Router's own advisory detail. Your call whether to accept this or force the downgrade and re-test routing.

## Config / secrets — confirmed set (local `.env`, gitignored)

- `DATABASE_URL`, `SUPABASE_URL` / `VITE_SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_JWKS_URL` (stored but not currently consumed — the app uses its own session system, not Supabase Auth JWT verification)
- `GOOGLE_SITE_VERIFICATION`, `SMARTSUPP_KEY` — env-driven, prod-only, no hardcoded IDs (from earlier checklist items)
- `HYPERDRIVE` references removed

## Not yet done (deploy-time, not code)

- **Vercel env vars**: none of the values above are set in Vercel yet — this was local-only work per your instruction not to deploy. You'll need to add the same keys to the Vercel project's Environment Variables before deploying.
- **`SUPABASE_STORAGE_BUCKET`**: defaults to `cgc-media` if unset — confirm that bucket exists in the Supabase project if Storage features are used.
- This report and the Supabase connection have not been pushed or deployed anywhere — everything above is local build + DB state only, as instructed.
