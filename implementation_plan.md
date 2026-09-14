# Implementation Plan — Verification & Finalization of Per-Account-Type Registration + KYC

**Repo:** `C:\Users\gigaf\.cline\data\workspaces\chat\city-gate-capital-platform` (branch `main`, in sync with `origin/main`)
**Base commit:** `5d73e33` ("Use postgres.js 'require' TLS mode for managed providers")
**Date:** 2026-09-14
**Mode:** Deep-planning protocol — this document is the agreed plan. Work below is limited to verification and, if needed, fixes to make verification green. No commits/pushes unless explicitly requested.

---

## Overview

The per-account-type registration + KYC gap implementation is **already written** and sits uncommitted on top of `5d73e33`. Deep investigation of every touched file confirmed the implementation is complete and internally consistent:

- **Flow (`src/shared/applicationFlow.ts`)** — 11 step ids (`contact`, `personal`, `security`, `review`, `preferences`, `verification`, `savings`, `business`, `ownership`, `multiCurrency`, `wealth`) with the new required selects present: `sourceOfFunds` (savings L187, multi-currency L248, wealth L269), `monthlyVolume` (multi-currency L247), `sourceOfWealth` (wealth L268).
- **Customer status page (`src/pages/application-status.tsx`)** — per-application KYC document upload form (`POST /api/kyc/documents` with `documentType`, optional `issuingCountry`, `document` file; JPEG/PNG/PDF ≤ 5 MB) plus next-action guidance for `SUBMITTED` and `NEEDS_INFORMATION` states.
- **Admin KYC panel (`src/pages/admin/kyc.tsx`, new)** — type/status/search filters, case drawer, document links via signed URLs; imports only `ExternalLink`, `Loader2` (no unused `Search` icon).
- **Admin shell wiring** — `src/routes.tsx` L102/L220 (`/admin/kyc` → `AdminOnly > AdminKyc`), `src/layouts/AdminLayout.tsx` L81 (`KYC & Onboarding`) + L104 (`KYC Review` → `/admin/kyc`) + L485 pending-verifications badge, matching the exact-string assertions in `adminUiCorrectness.test.ts`.
- **Server routes (`src/server/entry.ts` L785–790)** — `GET /api/admin/kyc-cases`, `GET /:id`, `POST /:id/notes`, `POST /:id/assign`, `GET /:id/documents/:documentId` (plus pre-existing `POST /:id/decision`).
- **Store & storage (`src/server/lib/kycCaseStore.ts`, `kycStorage.ts`)** — `listCasesForAdmin`, `getCaseWithApplication`, `addCaseNote`, `assignReviewer`, `getCaseDocument`, `getCaseDocumentPath`, and `createKycDocumentSignedUrl` (60 s default TTL); LIKE input escaped via `escapeLikePattern` (`inputValidator.ts` L105).
- **Migration (`src/server/db/migrations/0102_kyc_application_rls.sql`, new)** — enables RLS on `account_applications`, `application_events`, `kyc_cases`, `kyc_case_events`, `kyc_case_documents`; revokes `PUBLIC`/`anon`/`authenticated`; mirrors the migration-0056 private-KYC pattern; safe to run on any Postgres provider.
- **Tests** — new `src/test/server/kycCaseReviewPanel.test.ts` (RLS migration content, case detail 503/200, decision, notes, assign event, signed-URL route 400/404/503/200 + audit + no storage-path leak) and extended `adminUiCorrectness.test.ts`.

The previous session's verification batch was **interrupted during `npm ci`** (log ends with `^C`; status file never advanced past `=== npm ci ===`). `node_modules` is therefore in an unknown, possibly partial state. **The only remaining work is a clean, fully green verification run and the final report.** No code changes are planned unless a stage fails.

## Types

No new or changed types are required for this plan (verification-only). For reference, the types exercised by verification:

- `KycCaseRow` / handler signatures in `src/server/lib/kycCaseStore.ts` (e.g. `listCasesForAdmin(filter: { status?: string; accountType?: string; q?: string; limit?: number })` returning rows joined with `customerEmail`, `customerName`, `applicationReference`).
- Route handler contract `export default async function (req: Request, res: Response)` used by all `src/server/api/admin/kyc-cases/...` handlers.
- Signed-URL return `{ signedUrl: string; expiresAt: Date }` from `createKycDocumentSignedUrl`.

## Files

**Already implemented (uncommitted; validated by this plan, not modified unless a stage fails):**

| Path | State |
| --- | --- |
| `src/shared/applicationFlow.ts` | modified |
| `src/pages/application-status.tsx` | modified |
| `src/pages/admin/kyc.tsx` | new |
| `src/routes.tsx` | modified |
| `src/layouts/AdminLayout.tsx` | modified |
| `src/server/entry.ts` | modified |
| `src/server/api/admin/kyc-cases/GET.ts` | modified |
| `src/server/api/admin/kyc-cases/[id]/GET.ts` | new |
| `src/server/api/admin/kyc-cases/[id]/notes/` | new |
| `src/server/api/admin/kyc-cases/[id]/assign/` | new |
| `src/server/api/admin/kyc-cases/[id]/documents/` | new |
| `src/server/lib/kycCaseStore.ts` | modified |
| `src/server/lib/kycStorage.ts` | modified |
| `src/server/db/migrations/0102_kyc_application_rls.sql` | new |
| `src/test/server/kycCaseReviewPanel.test.ts` | new |
| `src/test/server/adminUiCorrectness.test.ts` | modified |

**Created by this plan:**

- `implementation_plan.md` (this file, repo root)
- Verification artifacts in `%TEMP%\cline\`: `run-verify.bat`, `verify-status.txt`, `verify-{npmci,typecheck,kycpanel,lint,test,build}.log` (temp only, never committed)

## Functions

No production functions will be written by this plan. Verification exercises:

- `npm run type-check` → `tsc --noEmit` over the whole tree (covers all handlers/store/flow types above).
- `npx vitest run src/test/server/kycCaseReviewPanel.test.ts --config vitest.server.config.mjs` → targeted KYC panel + RLS + signed-URL suite.
- `npm run lint` → `eslint .` (security/no-unsanitized/react-hooks rulesets).
- `npm run test:ci` → full server vitest suite (`vitest.server.config.mjs`: `src/**/*.{test,spec}.{ts,tsx}`, node env, single worker).
- `npm run build` → `vite build && vite build --ssr src/server/entry.ts && node scripts/copy-admin-docs.mjs` (proves SSR entry + admin KYC routes bundle; `scripts/copy-admin-docs.mjs` confirmed present).

If any stage fails, the fix is scoped to the failing assertion/stage only, then that stage (and any stage that could be affected) is re-run.

## Classes

None. The codebase uses functions/modules and Drizzle-style row objects; no class definitions are added or modified by this plan.

## Dependencies

- **Runtime/toolchain:** Node ≥ 22 with `engine-strict=true` (`.npmrc`); Node v24 present.
- **Install:** `npm ci --no-audit --no-fund` (clean reinstall — required because the previous run was interrupted; `npm ci` removes `node_modules` itself).
- **No new npm dependencies** are added. Everything used (typescript, eslint, vitest, vite, drizzle, postgres.js, supabase-js) is already pinned in `package-lock.json`.
- **Secrets:** none required. The repo has **no `.env`**; no credentials from the user-provided Downloads env files are echoed into logs, this document, or commits.

## Testing

1. **Stage order (via detached `run-verify.bat`, markers appended to `verify-status.txt`):**
   1. `npm ci` → `NPMCI_OK/_FAIL`
   2. `npm run type-check` → `TYPECHECK_OK/_FAIL`
   3. targeted `kycCaseReviewPanel.test.ts` → `KYCPANEL_OK/_FAIL`
   4. `npm run lint` → `LINT_OK/_FAIL`
   5. `npm run test:ci` → `TEST_OK/_FAIL`
   6. `npm run build` → `BUILD_OK/_FAIL`
   7. `VERIFY_DONE` marker
2. **Pass criteria:** all six stages `*_OK`.
3. **Failure handling:** per-stage log triage (`verify-<stage>.log`), minimal fix, re-run the failed stage; re-run `test:ci` if any production source file changed after it last passed.
4. **Explicitly NOT covered (caveat for the final report):** no live E2E. Without a live database/Storage/email configuration this environment cannot execute: applying migration `0102` to a real database, real Supabase Storage signed-URL issuance, admin auth against a live session, or email delivery. Coverage is by migration-content assertions, mocked handler tests, type-check, and build.

## Implementation Order

1. **Relaunch verification detached** (done at plan-execution start): `Start-Process cmd '/c run-verify.bat'` so polling cannot kill it.
2. **Write `implementation_plan.md`** (this document) while `npm ci` runs.
3. **Poll `verify-status.txt`** until `VERIFY_DONE`; consolidate per-stage PASS/FAIL.
4. **If all green:** produce the final report (stage table, what was validated, no-live-E2E caveat) and stop. Changes remain uncommitted.
5. **If any stage fails:** triage the stage log → minimal fix → re-run failed stage (plus `test:ci`/`type-check` if production sources changed) → loop to 3.
6. **Follow-ups requiring explicit user go-ahead (out of scope now):** git add/commit of the 16 paths above; applying `0102` + RLS verification against the authoritative production database.

## Assumptions, Open Questions & Risks

- **Database authority unconfirmed:** the user-provided env files reference Neon credentials, while `PRODUCTION_READINESS.md` describes a live Supabase project. The repo itself has no `.env`, so nothing here can resolve it — and nothing needs to: migration `0102` is written provider-agnostically (guards `anon`/`authenticated` revokes behind `pg_roles` existence checks) and the app talks to Postgres through `DATABASE_URL`. This stays an open question for deployment, not for verification.
- **No commits by default.** If the user wants the work committed, that is one explicit confirmation away; suggested message: `Add per-account-type KYC review panel, signed document URLs, RLS hardening and richer application flow`.
- **Risk — interrupted-install residue:** mitigated by `npm ci` (self-cleaning) rather than `npm install`.
- **Risk — flaky full suite:** `vitest.server.config.mjs` already serializes (single worker, `fileParallelism: false`); a genuine failure is fixed, an environment flake is re-run once and noted.
- **Secret hygiene:** Downloads env files with Neon/Supabase credentials are never echoed, logged, or committed.

---

## Verification Findings & Fixes Applied (2026-09-14)

The first completed batch failed per-stage; triage found three root causes (plus the earlier `documents/[documentId]/GET.ts` import-depth bug, fixed pre-batch). Fixes applied and re-verified:

1. **Admin KYC routes responded without an explicit status on success paths** — `assign/POST.ts`, the case-detail `GET.ts` and the document signed-URL `GET.ts` called bare `res.json(...)`, so an explicit-status assertion captured `0` ("expected +0 to be 200"). Fixed: `res.status(200).json(...)` in all three (Express behavior unchanged for real clients; consistent with the sibling routes and the 201 notes path).
2. **Signed-URL issuance violated the pre-existing `kycPrivateSchema.test.ts` guard** (kycStorage.ts must never contain `createSignedUrl`/`getPublicUrl`). Fixed by moving `createKycDocumentSignedUrl` verbatim into the new `src/server/lib/kycDocumentSigning.ts`, which imports the now-exported `storageClient` and `KYC_BUCKET` from `kycStorage.ts`; the admin route imports the new module. The guard's intent — the customer-facing write surface never mints URLs — is preserved and the old test is unchanged.
3. **`kycCaseReviewPanel.test.ts` double dispatched on schema module identity**, which breaks across `vi.resetModules()` generations: the mocked `db.js` factory result is cached with a stale schema instance while the re-imported store gets a fresh one, so every row-provisioning test 404'd. Fixed: dispatch on the table's SQL name via drizzle's `getTableName` (`kyc_cases`, `account_applications`, `kyc_case_documents`, `kyc_case_events`) — pure table data, stable across module generations.

Also added the missing toast render block in `src/pages/admin/kyc.tsx` (the `flash()` state existed but was never displayed) — resolves TS6133 + eslint `no-unused-vars`.

**Final verification result (diag4 batch, 2026-09-14):**
- `type-check` **PASS** · `lint` **PASS**
- `kycCaseReviewPanel.test.ts` **22/22 PASS**
- `test:ci` **PASS — 191/191 test files, 931/931 tests** (includes `kycPrivateSchema`, `kycPrivateStorage`, `adminApplications`, `adminUiCorrectness`)
- `build` **PASS** — client bundle ✓, SSR bundle ✓ (`dist/server.bundle.mjs`), admin docs copied ✓ (`{"ok":true,"artifact":"dist/admin-docs"}`)

**Re-run confirmation (diag5 detached batch, 2026-09-14, same working tree):** `TYPECHECK_OK · LINT_OK · KYCPANEL_OK (22/22) · TEST_OK (191 files / 931 tests) · BUILD_OK (client 17.0s, SSR 25.8s, admin-docs copied) — DIAG5_DONE. All six stages green on a fresh run.




