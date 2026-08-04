# City Gate Capital — Final Production Audit Report

**Branch:** `claude/city-gate-repo-init-r9spdg` · **PR:** [#5](https://github.com/admin042citygatecapital/citygate-banking-platform/pull/5) (draft, follow-up to merged #4)
**Date:** 2026-07-23

This report covers the final validation pass requested against the uploaded `citygate_capital.zip` (confirmed byte-identical to the copy already fully extracted, inventoried, and reconciled into the repo earlier in this session — see PR #4, merged). No new source material was introduced this pass; this is a completeness/correctness audit of the already-reconciled repository.

---

## 1. Files imported from the ZIP

None this pass. The ZIP's full contents (frontend pages, ~105 API route handlers, KYC support libs, static assets, docs) were already reconciled into the repo across PR #4's 44 commits, verified as byte-identical, and not re-imported.

## 2. Files added (this pass)

- `src/server/api/admin/security/logs/GET.ts` — new endpoint (see §15)
- `src/lib/format-overrides.ts` — was referenced by `vite-env.d.ts`/`vitest.config.ts` but never created (fixed earlier this session)

## 3. Files modified (this pass, 20 files)

`eslint.config.js`, `src/pages/admin/links.tsx`, `src/pages/index.tsx`, `src/pages/kyc.tsx`, `src/server/api/admin/auth/login/POST.ts`, `src/server/api/admin/zoho/oauth/callback/GET.ts`, `src/server/api/contact/POST.ts`, `src/server/api/users/login/POST.ts`, `src/server/api/users/tickets/POST.ts`, `src/server/api/zoho/callback/GET.ts`, `src/server/api/zoho/status/GET.ts`, `src/server/entry.ts`, `src/server/lib/adminAuthMiddleware.ts`, `src/server/lib/cmsExtStore.ts`, `src/server/lib/customerAuthMiddleware.ts`, `src/server/lib/market/providers/finnhub.ts`, `src/server/lib/pathHardeningMiddleware.ts`, `src/test/unit/auth.test.ts`, `src/test/unit/security.test.ts`

Full detail in commit `4cf77ef`. Summary of *why*:
- **Two live routing bugs found via a full route-matrix audit** (every registered backend route cross-referenced against its actual frontend caller — see attached `ROUTE_MATRIX.md`):
  - Customer `/kyc` page's entire flow (status/upload/submit) called `/api/users/kyc/{status,submit,upload-url}` — correct handler files existed but were **never registered in `entry.ts`**. KYC verification has never worked end-to-end. Fixed.
  - `admin/security.tsx`'s Login Logs / HTTP Logs tabs called a nonexistent `/api/admin/security/logs`. Built from existing real stores (`loginLog.ts`, `accessLog.ts`) — no fabricated data.
- **ESLint config fix**: 593/638 reported errors were one root cause (missing browser/Node globals in the flat config). Disabled `no-undef` for TS files per typescript-eslint's own guidance — `tsc` already performs this check with full lib-aware type knowledge. Remaining 45 real issues fixed individually (dead code, mojibake text corruption, wrong test-framework type, redundant casts, a name collision, two documented false-positive rule exceptions for legitimate security regexes / Express type augmentation).

## 4. Files deleted, with justification

None this pass. (Earlier this session: `admin/kyc/GET.ts` + 8 files under a broken `admin/kyc/userId/` tree, `kycExpiryChecker.ts`, `llms-txt.ts`, `seo-host.ts` — all confirmed dead/unreachable/broken, documented in prior commits on this branch.)

## 5. Build results

| Step | Result |
|---|---|
| `npm run build` (client, Vite) | ✅ Success — chunk-size warning only (non-blocking, `admin-pages` chunk 1.27 MB) |
| `npm run build` (SSR) | ✅ Success — mixed static/dynamic-import warnings only (non-blocking) |
| `npm start` | ✅ Binds to port, serves real responses |

## 6. TypeScript result

**0 non-test errors.** Remaining 25 errors are entirely in the pre-existing, known cluster (`src/test/unit/{userStore,sessionStore,auth}.test.ts`) calling now-async store functions synchronously — a pre-existing gap that was explicitly out of scope to "fix" by altering app behavior, per standing instruction from earlier in this session.

## 7. ESLint result

**0 errors, 44 warnings** (all non-blocking): 23 `@typescript-eslint/no-explicit-any`, 12 `react-refresh/only-export-components`, 5 `react-hooks/exhaustive-deps`, 4 misc parser warnings on test files. None indicate correctness bugs.

## 8. Test results

`vitest run`: **44 passed, 13 failed** (3 files: `userStore.test.ts`, `sessionStore.test.ts`, `auth.test.ts`) — same pre-existing count as session start and every checkpoint since. Root cause: these tests call `findUserById`, `getSession`, etc. synchronously, but those functions are now async (part of the real Postgres/flat-file dual-mode architecture). Fixing the tests requires either rewriting them to `await` (test-only change, never done per standing "don't touch tests to hide real gaps, but also don't alter app behavior for tests" instruction ambiguity — flagged, not silently fixed) or reverting the app to sync store functions (would break the real DB integration). **Recommend**: update the test files to await these calls — pure test-code fix, zero app-behavior change, safe to do as an explicit follow-up if wanted.

## 9. Database / Neon status

- **Connection**: `src/server/db/db.ts` reads `DATABASE_URL` only from `process.env`, gated by `isDatabaseConfigured()`. No credentials hardcoded anywhere (verified via the secrets-scan below).
- **Dual-mode architecture**: every `*Store.ts` module checks `isDatabaseConfigured()` and transparently falls back to flat-file JSONL under `/private/` when no `DATABASE_URL` is set. This is intentional, working, and does **not** silently hide DB failures — `getDb()` throws explicitly if called without `DATABASE_URL` configured (`"getDb() called without DATABASE_URL configured — guard with isDatabaseConfigured() first"`).
- **Schema**: `src/server/db/schema.ts` is the single source of truth (Drizzle ORM, PostgreSQL dialect), matches every store module's data model — verified as part of this session's extensive store-layer work (including two new columns added this session: `subscribers.sequence_step` / `subscribers.last_email_at` for the newsletter nurture-sequence feature).
- **⚠️ Finding**: `package.json` declares five `db:*` npm scripts (`db:migrate`, `db:schema`, `db:import`, `db:import:dry`, `db:validate`, `db:rollback`) that all reference files under `src/server/db/` **which do not exist** (`migrate.ts`, `applySchemaFetch.ts`, `importFlatFiles.ts`, `validateMigration.ts`, `rollback.ts`). Every one of these scripts would fail immediately with a module-not-found error. This is a pre-existing gap, not something this session's changes caused.
- **Actual working migration path**: this is a schema-push project (no `.sql` migration files exist under the configured `out: ./src/server/db/migrations` directory — it doesn't exist yet either). The real, working command is:
  ```
  npx drizzle-kit push
  ```
  `drizzle.config.ts` has `strict: true`, which makes `drizzle-kit push` interactively confirm before applying any destructive schema change — this is the safety gate; **no migration runs against production without explicit confirmation.**

## 10. Pending migrations

None tracked (no migration-file history exists — schema-push model). Running `npx drizzle-kit push` against a fresh Neon database will create every table in `schema.ts` from scratch. If a database already has data from a previous partial push, `drizzle-kit push` will diff and prompt before altering/dropping anything.

## 11. Required environment variables / secrets

| Variable | Level | Purpose |
|---|---|---|
| `ADMIN_PASSWORD_HASH` | **CRITICAL** | bcrypt hash (cost 12) of the admin password — app refuses to start in production without it |
| `SESSION_SECRET` (alias `JWT_SECRET`) | **CRITICAL** in production | Session token signing key, ≥32 random chars |
| `DATABASE_URL` | Optional | Neon/Postgres connection string — omit to run on flat-file storage |
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN` | Optional (warning) | Zoho Mail OAuth — email delivery degrades to logged-only without these |
| `ADMIN_EMAIL`, `ZOHO_ACCOUNT_ID`, `APP_URL`, `ADMIN_URL`, `API_BASE_URL` | Optional (info, has defaults) | — |
| `SMARTSUPP_KEY`/`_API_KEY`, `CLOUDFLARE_*`, `GA_*`, `GTM_*`, `GOOGLE_MAPS_API_KEY`, `STRIPE_*`, `PAYPAL_*`, `TWILIO_*`, `WHATSAPP_*`, `FLUTTERWAVE_SECRET_KEY`, `PAYSTACK_SECRET_KEY`, `BANKING_API_KEY`, `ADMIN_UNLOCK_KEY` | Optional | Feature-specific third-party integrations — each degrades gracefully / reports itself unconfigured rather than failing silently (verified via `src/server/lib/envValidator.ts`'s real startup report) |

None of these are hardcoded anywhere in the codebase — confirmed via `grep` for literal secret-shaped strings across `src/` during this and prior audit passes this session.

## 12. Authentication status

**Confirmed intact via a dedicated security regression check earlier this session** (re-verified applicable to all routes touched since):
- Customer and admin auth are fully separate systems (`customerAuthMiddleware.ts` / `adminAuthMiddleware.ts`, separate token namespaces, separate session stores) — no shared session state.
- Passwords: Argon2id (`@node-rs/argon2`) with transparent bcrypt/PBKDF2 legacy-hash upgrade on successful login.
- Session tokens are never returned in plaintext in any API response (`tokenPreview` truncation pattern used consistently).

## 13. RBAC / security status

- Every sensitive admin mutation checked against its `entry.ts` registration this session: KYC actions require `COMPLIANCE_ADMIN`, user create/delete/2FA-reset/password-reset require `requireSuperAdmin`, currency changes require `FINANCE_ADMIN`, security-alert/session-termination mutations require `SECURITY_ADMIN`, SMTP config requires `requireSuperAdmin`.
- Balance adjustment is atomic (single guarded SQL `UPDATE`, not a check-then-write race).
- Rate limiting (`rateLimiter.ts`) and brute-force lockout (`bruteForce.ts`) are wired into both login endpoints.
- Security headers, CORS, and CSRF are configured (`securityMiddleware.ts`, `securityHeaders`, restrictive `corsOrigins` built from `ALLOWED_ORIGINS`/`FRONTEND_DOMAIN` env vars — not wildcard-open).
- Logs never expose passwords, tokens, PANs, or CVVs — card numbers/CVVs are AES-256-GCM encrypted at rest (`cardStore.ts`) and masked in every admin-facing read.

## 14. API route coverage

**289 routes registered in `entry.ts`.** Every import resolves to a real handler file on disk — no dangling registrations, no duplicate `(method, path)` pairs. Full breakdown in the attached `ROUTE_MATRIX.md` (grouped into 20 feature-area tables).

## 15. Frontend-to-backend connectivity status

- **176 routes** have a confirmed frontend caller (`fetch()`/`window.open()`/`href` call site found).
- **113 routes** are backend-only with no frontend caller found — the large majority are legitimate admin/API surface (bulk-export endpoints, webhook receivers, less-used admin tooling) rather than dead code; each is listed individually in `ROUTE_MATRIX.md` for your own review.
- **2 broken wirings found and fixed this pass** (KYC flow, security logs — see §3).
- **1 remaining known gap, left unfixed** (see §16).

## 16. Remaining blockers

None block a production deploy. Two non-blocking items worth your attention:

1. **`src/pages/admin/EmailDiagnostics.tsx` is orphaned** — a real, non-trivial (316-line) email-transport health dashboard that is (a) not registered in `src/routes.tsx` at all, so it's unreachable in the running app, and (b) calls a `/api/admin/email/health` endpoint that doesn't exist. Since it's unreachable, this is not a live bug, but it represents incomplete prior work. I did not build it out this pass — wiring it up would mean designing a new backend shape (`{oauth, smtp, queue}` health status + a log-entry list) distinct from the already-real `/api/admin/email/status` endpoint, which is new-feature scope beyond this audit. **Recommend**: tell me whether to (a) build the missing endpoint + route it in, or (b) delete the orphaned page as dead code.
2. **The five dead `db:*` npm scripts** (§9) — recommend either building the missing scripts or removing them from `package.json` to avoid confusing a future operator.
3. **13 pre-existing test failures** (§8) — recommend the test-file `await` fix described there.

## 17. Exact deployment steps

```bash
# 1. Install dependencies (includes ws's bufferutil/utf-8-validate native addons,
#    now real optionalDependencies — fixed this session)
npm install

# 2. Configure secrets (see §11) — at minimum for production:
export ADMIN_PASSWORD_HASH='<bcrypt hash, cost 12>'
export SESSION_SECRET='<32+ random chars>'
# Optional but recommended:
export DATABASE_URL='<Neon connection string>'

# 3. If using a database, push the schema (interactive confirmation on
#    destructive changes — safe to run against production):
npx drizzle-kit push

# 4. Build (sets NODE_ENV=production internally — required for the SSR
#    bundle's static-serving code path to actually compile in; see the
#    critical build-startup fix from earlier this session):
npm run build

# 5. Start:
npm start
# → binds 0.0.0.0:${PORT:-3000}, verified this session to actually serve
#   real responses (previously it silently never started — see PR history)
```

**Verified this session**: a full `npm run build && npm start` cycle with throwaway (non-production) secret values returns real HTTP 200s on `/`, `/login`, `/dashboard`, and correct 401s (not 404s or crashes) on unauthenticated admin/customer API calls.
