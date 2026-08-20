# Phase 1 increment 6 — Login integration (managed-admin sign-in, multi-role sessions)

**Branch:** `feat/admin-control-plane-rbac`
**Status in cloud:** type-check ✅ · lint ✅ · **533/533 tests ✅** · **build ✅**
**⚠ Auth-path change — review carefully and smoke-test on a real DB before merging.** The env SUPER_ADMIN break-glass path is preserved unchanged; managed sign-in is added as a fallback.

## What changed
1. **Unified login resolver** (`adminCredentials.resolveAdminForLogin`) — resolves the env SUPER_ADMIN first (unchanged); otherwise a managed admin, but only if **active + has a password + has ≥1 role** (else `undefined` → generic invalid-credentials, no enumeration). `pickPrimaryRole` chooses the session's primary role by canonical priority.
2. **Both auth sites updated consistently** — `auth/login/POST.ts` and `auth/otp/verify/POST.ts` now use the resolver, **remove the hard-coded SUPER_ADMIN-only gate**, and create the session with the resolved `role` + full `roles`. All existing security (2FA/OTP, brute-force lockout, trusted devices, secure cookies, login alerts, audit) is untouched.
3. **Multi-role sessions** — `Session.roles` added; `admin_sessions.roles` JSONB column (migration `0050`, nullable/idempotent). The authorization middleware now unions permissions across `session.roles` (falls back to the single `role` for pre-existing sessions; a set containing SUPER_ADMIN is wildcard).
4. **Set-password endpoint** — `POST /api/admin/access/admins/:id/password` (SUPER_ONLY): super-admin sets a managed admin's password; hashed server-side with Argon2id; raw value and hash are never audited.
5. **Store additions** — `findManagedAdminByEmail`, `setAdminPassword`, `markAdminLogin`.

## Files
New: `.../access/admins/[id]/password/POST.ts`, `migrations/0050_admin_session_roles.sql`, `test/server/adminLoginIntegration.test.ts`.
Changed (full files): `adminCredentials.ts`, `adminIdentityStore.ts`, `sessionStore.ts`, `adminAuthorizationMiddleware.ts`, `schema.ts`, `auth/login/POST.ts`, `auth/otp/verify/POST.ts`.
Patch: `entry.ts` — apply `entry.ts.patch.md`.

## Tests added
Resolver (env super resolves; unknown → undefined; primary-role selection) and multi-role enforcement (permission union across roles; denial when no role holds it; SUPER wildcard; single-role back-compat).

## Operational note
Applies only once migrations `0047–0050` are on the DB. Recommended smoke test: create a managed admin → set a password → assign e.g. `COMPLIANCE_ADMIN` → sign in at `/admin/login` → confirm access to `/admin/kyc` and denial on `/admin/transactions`, with the env SUPER_ADMIN still fully working.

## Phase 1 is now complete end-to-end: enforcement · audit · identity · API · UI · login.
