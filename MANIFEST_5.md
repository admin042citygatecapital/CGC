# Phase 1 increment 5 — /admin/access React page

**Branch:** `feat/admin-control-plane-rbac`
**Status in cloud:** type-check ✅ · lint ✅ · **526/526 tests ✅** · **build ✅** (emits `access-*.js` chunk)
**Scope:** client UI only; calls the increment-4 API. Premium dark/gold theme, glassmorphism, motion — matches the existing admin pages (AdminLayout, useAdminAuth, authHeaders/CSRF).

## What it does
- **Roles & permissions** panel — the full RBAC catalogue from `GET /api/admin/access/roles` (collapsible per role, permission chips).
- **Administrators** list — from `GET /api/admin/access/admins`, with each admin's roles.
- **Add administrator** — name/email/role toggles/reason → `POST /api/admin/access/admins`.
- **Edit roles** drawer — per-admin role toggles + reason → `POST /api/admin/access/admins/:id/roles`.
- Full **loading / empty / error / success** states; 403 shows "restricted to super-administrator"; 503 shows "storage not configured"; toasts with `aria-live`; responsive grid; keyboard-accessible controls; `noindex`.

## New file
- `src/pages/admin/access.tsx`

## Changed file
- `src/routes.tsx` — **apply `routes.tsx.patch.md`** (lazy import + `/admin/access` route under `<AdminOnly>`; do not overwrite).

## Remaining for full end-to-end
- **Login integration** (chosen: enable the same `/admin/login` for managed admins) — the one remaining auth-path increment. Until then the page manages identities/roles but managed admins can't yet sign in.
