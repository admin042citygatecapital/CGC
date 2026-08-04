# City Gate Capital — Route Matrix

_Generated 2026-07-23 from a full read of `src/server/entry.ts` (1174 lines) cross-referenced against `src/pages`, `src/lib`, `src/hooks`, `src/components`, and `src/layouts` for frontend `fetch()`/`window.open()`/`href` call sites._

**Totals:** 289 registered routes (289 imports, 289 registrations, no duplicate method+path pairs, all imported handler files exist on disk — no dead imports found).

| Legend | Meaning |
|---|---|
| `wired` | A literal fetch/window.open/href call to this exact path was found in the frontend |
| `backend-only/unused` | Route is registered and its handler file exists, but no frontend call site was found |
| `dead` | Would mean the registration doesn't actually resolve — **none found; see Suspicious Findings below instead** |

See the **Suspicious Findings** section at the bottom for mismatches between frontend calls and the registered route table (frontend calling routes that do not exist).

---

## Admin Auth & Session

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/admin/auth/diag` | GET | `api/admin/auth/diag/GET.ts` | public (excluded from admin-session gate) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/auth/login` | POST | `api/admin/auth/login/POST.ts` | public (excluded from admin-session gate) | none beyond auth | `src/lib/adminAuth.tsx` | wired |
| `/api/admin/auth/logout` | POST | `api/admin/auth/logout/POST.ts` | public (excluded from admin-session gate) | none beyond auth | `src/lib/adminAuth.tsx` | wired |
| `/api/admin/auth/otp/verify` | POST | `api/admin/auth/otp/verify/POST.ts` | public (excluded from admin-session gate) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/auth/password-reset` | POST | `api/admin/auth/password-reset/POST.ts` | public (excluded from admin-session gate) | none beyond auth | `src/pages/admin/forgot-password.tsx` | wired |
| `/api/admin/auth/password-reset/confirm` | POST | `api/admin/auth/password-reset/confirm/POST.ts` | public (excluded from admin-session gate) | none beyond auth | `src/pages/admin/reset-password.tsx` | wired |
| `/api/admin/auth/trusted-devices` | DELETE | `api/admin/auth/trusted-devices/DELETE.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/auth/trusted-devices` | GET | `api/admin/auth/trusted-devices/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/auth/unlock` | POST | `api/admin/auth/unlock/POST.ts` | public (excluded from admin-session gate) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/auth/verify` | GET | `api/admin/auth/verify/GET.ts` | public (excluded from admin-session gate) | none beyond auth | `src/lib/adminAuth.tsx` | wired |

## Customer Auth & Session

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/users/2fa/setup` | POST | `api/users/2fa/setup/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/security.tsx` | wired |
| `/api/users/2fa/verify` | POST | `api/users/2fa/verify/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/security.tsx` | wired |
| `/api/users/login` | POST | `api/users/login/POST.ts` | public (pre-auth) | none beyond auth | `src/lib/customerAuth.tsx` | wired |
| `/api/users/logout` | POST | `api/users/logout/POST.ts` | customer-bearer (optional/idempotent, manual) | none beyond auth | `src/lib/customerAuth.tsx` | wired |
| `/api/users/password-reset` | POST | `api/users/password-reset/POST.ts` | public (pre-auth) | none beyond auth | `src/pages/forgot-password.tsx` | wired |
| `/api/users/password-reset/confirm` | POST | `api/users/password-reset/confirm/POST.ts` | public (pre-auth) | none beyond auth | `src/pages/reset-password.tsx` | wired |
| `/api/users/register` | POST | `api/users/register/POST.ts` | public (pre-auth) | none beyond auth | `src/pages/register.tsx` | wired |
| `/api/users/session` | GET | `api/users/session/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/lib/customerAuth.tsx` | wired |
| `/api/users/verify-email` | GET | `api/users/verify-email/GET.ts` | public (pre-auth) | none beyond auth | no frontend caller found | backend-only/unused |

## Admin - KYC & Compliance

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/admin/kyc/:userId` | GET | `api/admin/kyc/[userId]/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/kyc-review.tsx` | wired |
| `/api/admin/kyc/analytics` | GET | `api/admin/kyc/analytics/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/kyc.tsx` | wired |
| `/api/admin/kyc/approve` | POST | `api/admin/kyc/approve/POST.ts` | admin-session (requireAdminAuth) | requireRole('COMPLIANCE_ADMIN') | `src/pages/admin/kyc-review.tsx` | wired |
| `/api/admin/kyc/extend` | POST | `api/admin/kyc/extend/POST.ts` | admin-session (requireAdminAuth) | requireRole('COMPLIANCE_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/admin/kyc/flag` | POST | `api/admin/kyc/flag/POST.ts` | admin-session (requireAdminAuth) | requireRole('COMPLIANCE_ADMIN') | `src/pages/admin/kyc-review.tsx` | wired |
| `/api/admin/kyc/note` | POST | `api/admin/kyc/note/POST.ts` | admin-session (requireAdminAuth) | requireRole('COMPLIANCE_ADMIN') | `src/pages/admin/kyc-review.tsx` | wired |
| `/api/admin/kyc/queue` | GET | `api/admin/kyc/queue/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/kyc-queue.tsx`, `src/pages/admin/compliance.tsx` | wired |
| `/api/admin/kyc/queue/export` | GET | `api/admin/kyc/queue/export/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/kyc-queue.tsx` | wired |
| `/api/admin/kyc/reject` | POST | `api/admin/kyc/reject/POST.ts` | admin-session (requireAdminAuth) | requireRole('COMPLIANCE_ADMIN') | `src/pages/admin/kyc-review.tsx` | wired |
| `/api/admin/kyc/request-info` | POST | `api/admin/kyc/request-info/POST.ts` | admin-session (requireAdminAuth) | requireRole('COMPLIANCE_ADMIN') | `src/pages/admin/kyc-review.tsx` | wired |
| `/api/admin/kyc/settings` | GET | `api/admin/kyc/settings/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/kyc/settings` | POST | `api/admin/kyc/settings/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/kyc/stats` | GET | `api/admin/kyc/stats/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |

## Admin - Trading

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/admin/trading` | GET | `api/admin/trading/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/trading.tsx` | wired |
| `/api/admin/trading/active-traders` | GET | `api/admin/trading/active-traders/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/trading.tsx` | wired |
| `/api/admin/trading/fees` | GET | `api/admin/trading/fees/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/trading.tsx` | wired |
| `/api/admin/trading/fees` | POST | `api/admin/trading/fees/POST.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | `src/pages/admin/trading.tsx` | wired |
| `/api/admin/trading/freeze` | GET | `api/admin/trading/freeze/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/trading.tsx` | wired |
| `/api/admin/trading/freeze` | POST | `api/admin/trading/freeze/POST.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | `src/pages/admin/trading.tsx` | wired |
| `/api/admin/trading/logs` | GET | `api/admin/trading/logs/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/trading.tsx` | wired |
| `/api/admin/trading/markets` | GET | `api/admin/trading/markets/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/trading.tsx` | wired |
| `/api/admin/trading/markets` | PUT | `api/admin/trading/markets/PUT.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | `src/pages/admin/trading.tsx` | wired |
| `/api/admin/trading/markets/suspend` | POST | `api/admin/trading/markets/suspend/POST.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | `src/pages/admin/trading.tsx` | wired |
| `/api/admin/trading/providers` | GET | `api/admin/trading/providers/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/trading.tsx` | wired |
| `/api/admin/trading/providers` | PUT | `api/admin/trading/providers/PUT.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | `src/pages/admin/trading.tsx` | wired |

## Admin - Cards, Balances & Transactions

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/admin/balance/adjust` | POST | `api/admin/balance/adjust/POST.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | `src/pages/admin/banking.tsx`, `src/components/admin/BalanceModal.tsx` | wired |
| `/api/admin/balance/history` | GET | `api/admin/balance/history/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/cards` | GET | `api/admin/cards/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/cards.tsx` | wired |
| `/api/admin/cards/:id/activity` | GET | `api/admin/cards/[id]/activity/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/cards.tsx` | wired |
| `/api/admin/cards/freeze` | POST | `api/admin/cards/freeze/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | `src/pages/admin/cards.tsx` | wired |
| `/api/admin/cards/issue` | POST | `api/admin/cards/issue/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | `src/pages/admin/cards.tsx` | wired |
| `/api/admin/cards/pin` | POST | `api/admin/cards/pin/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | `src/pages/admin/cards.tsx` | wired |
| `/api/admin/cards/replace` | POST | `api/admin/cards/replace/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | `src/pages/admin/cards.tsx` | wired |
| `/api/admin/cards/spending-limit` | POST | `api/admin/cards/spending-limit/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | `src/pages/admin/cards.tsx` | wired |
| `/api/admin/rates` | GET | `api/admin/rates/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/rates.tsx` | wired |
| `/api/admin/rates/fee-history` | GET | `api/admin/rates/fee-history/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/rates.tsx` | wired |
| `/api/admin/rates/fx-markup` | POST | `api/admin/rates/fx-markup/POST.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | `src/pages/admin/rates.tsx` | wired |
| `/api/admin/rates/limits` | POST | `api/admin/rates/limits/POST.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | `src/pages/admin/rates.tsx` | wired |
| `/api/admin/rates/limits/user` | GET | `api/admin/rates/limits/user/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/rates.tsx` | wired |
| `/api/admin/rates/tier-fees` | POST | `api/admin/rates/tier-fees/POST.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | `src/pages/admin/rates.tsx` | wired |
| `/api/admin/rates/tx-fees` | POST | `api/admin/rates/tx-fees/POST.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | `src/pages/admin/rates.tsx` | wired |
| `/api/admin/settings/rates` | GET | `api/admin/settings/rates/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/rates.tsx` | wired |
| `/api/admin/settings/rates` | POST | `api/admin/settings/rates/POST.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | `src/pages/admin/rates.tsx` | wired |
| `/api/admin/transactions` | GET | `api/admin/transactions/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/transactions.tsx` | wired |
| `/api/admin/transactions/approve` | POST | `api/admin/transactions/approve/POST.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | `src/pages/admin/banking.tsx` | wired |
| `/api/admin/transactions/create` | POST | `api/admin/transactions/create/POST.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/admin/transactions/freeze` | POST | `api/admin/transactions/freeze/POST.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/admin/transactions/real` | GET | `api/admin/transactions/real/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/banking.tsx` | wired |
| `/api/admin/transactions/reject` | POST | `api/admin/transactions/reject/POST.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | `src/pages/admin/banking.tsx` | wired |
| `/api/admin/wallets` | GET | `api/admin/wallets/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/wallets` | PATCH | `api/admin/wallets/PATCH.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |

## Admin - CMS & Website Content

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/admin/cms` | GET | `api/admin/cms/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/cms.tsx` | wired |
| `/api/admin/cms` | POST | `api/admin/cms/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/cms.tsx` | wired |
| `/api/admin/cms/blog` | GET | `api/admin/cms/blog/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/cms/blog` | POST | `api/admin/cms/blog/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/cms/features` | GET | `api/admin/cms/features/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/cms/features` | POST | `api/admin/cms/features/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/cms/hero` | GET | `api/admin/cms/hero/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/cms/hero` | POST | `api/admin/cms/hero/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/cms/logo` | GET | `api/admin/cms/logo/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/cms/logo` | POST | `api/admin/cms/logo/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/cms/navigation` | GET | `api/admin/cms/navigation/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/cms/navigation` | POST | `api/admin/cms/navigation/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/cms/news` | GET | `api/admin/cms/news/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/cms/news` | POST | `api/admin/cms/news/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/links` | GET | `api/admin/links/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/links.tsx` | wired |
| `/api/admin/links` | POST | `api/admin/links/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/links.tsx` | wired |
| `/api/admin/media` | GET | `api/admin/media/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/media.tsx` | wired |
| `/api/admin/media` | POST | `api/admin/media/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/media.tsx` | wired |
| `/api/admin/media/replace` | POST | `api/admin/media/replace/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/media.tsx` | wired |
| `/api/admin/social` | GET | `api/admin/social/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/social.tsx` | wired |
| `/api/admin/social` | POST | `api/admin/social/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/social.tsx` | wired |
| `/api/admin/website` | GET | `api/admin/website/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/website.tsx` | wired |
| `/api/admin/website` | POST | `api/admin/website/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/website.tsx` | wired |

## Admin - Email & SMTP

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/admin/email/flush` | POST | `api/admin/email/flush/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/smtp.tsx`, `src/pages/admin/email.tsx` | wired |
| `/api/admin/email/log` | GET | `api/admin/email/log/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/EmailDiagnostics.tsx`, `src/pages/admin/email.tsx` | wired |
| `/api/admin/email/purge` | POST | `api/admin/email/purge/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/email/queue` | GET | `api/admin/email/queue/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/smtp.tsx`, `src/pages/admin/email.tsx` | wired |
| `/api/admin/email/queue/:id` | DELETE | `api/admin/email/queue/[id]/DELETE.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/email.tsx` | wired |
| `/api/admin/email/queue/retry` | POST | `api/admin/email/queue/retry/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/smtp.tsx`, `src/pages/admin/email.tsx` | wired |
| `/api/admin/email/requeue` | POST | `api/admin/email/requeue/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/smtp.tsx` | wired |
| `/api/admin/email/status` | GET | `api/admin/email/status/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/email.tsx` | wired |
| `/api/admin/email/templates` | GET | `api/admin/email/templates/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/email.tsx` | wired |
| `/api/admin/email/templates` | POST | `api/admin/email/templates/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | `src/pages/admin/email.tsx` | wired |
| `/api/admin/email/templates/reset` | POST | `api/admin/email/templates/reset/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | no frontend caller found | backend-only/unused |
| `/api/admin/email/test` | POST | `api/admin/email/test/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/EmailDiagnostics.tsx`, `src/pages/admin/security.tsx` | wired |
| `/api/admin/smtp/config` | GET | `api/admin/smtp/config/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/smtp.tsx` | wired |
| `/api/admin/smtp/config` | POST | `api/admin/smtp/config/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | `src/pages/admin/smtp.tsx` | wired |
| `/api/admin/smtp/mode` | POST | `api/admin/smtp/mode/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | `src/pages/admin/smtp.tsx` | wired |
| `/api/admin/smtp/status` | GET | `api/admin/smtp/status/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/smtp.tsx` | wired |
| `/api/admin/smtp/test` | POST | `api/admin/smtp/test/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | `src/pages/admin/smtp.tsx`, `src/pages/admin/email.tsx` | wired |
| `/api/admin/smtp/test-template` | POST | `api/admin/smtp/test-template/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | no frontend caller found | backend-only/unused |
| `/api/admin/smtp/verify` | POST | `api/admin/smtp/verify/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | `src/pages/admin/smtp.tsx` | wired |

## Admin - Support & Helpdesk

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/admin/smartsupp/agents` | GET | `api/admin/smartsupp/agents/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/smartsupp/agents` | POST | `api/admin/smartsupp/agents/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/smartsupp/analytics` | GET | `api/admin/smartsupp/analytics/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/smartsupp/config` | GET | `api/admin/smartsupp/config/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/smartsupp/config` | POST | `api/admin/smartsupp/config/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/smartsupp/conversations` | GET | `api/admin/smartsupp/conversations/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/smartsupp/conversations` | POST | `api/admin/smartsupp/conversations/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/smartsupp/faq` | GET | `api/admin/smartsupp/faq/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/smartsupp/faq` | POST | `api/admin/smartsupp/faq/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/smartsupp/tickets` | GET | `api/admin/smartsupp/tickets/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/smartsupp/tickets` | POST | `api/admin/smartsupp/tickets/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support` | GET | `api/admin/support/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/support.tsx` | wired |
| `/api/admin/support/announcements` | GET | `api/admin/support/announcements/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/announcements` | POST | `api/admin/support/announcements/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/assign` | POST | `api/admin/support/assign/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/bulk` | POST | `api/admin/support/bulk/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/canned` | DELETE | `api/admin/support/canned/DELETE.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/canned` | GET | `api/admin/support/canned/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/canned` | POST | `api/admin/support/canned/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/canned` | PUT | `api/admin/support/canned/PUT.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/complaints` | GET | `api/admin/support/complaints/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/complaints` | POST | `api/admin/support/complaints/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/contact-forms` | GET | `api/admin/support/contact-forms/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/contact-forms` | POST | `api/admin/support/contact-forms/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/feedback` | GET | `api/admin/support/feedback/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/feedback` | POST | `api/admin/support/feedback/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/messages` | GET | `api/admin/support/messages/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/messages` | POST | `api/admin/support/messages/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/note` | POST | `api/admin/support/note/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/notifications` | GET | `api/admin/support/notifications/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/notifications` | POST | `api/admin/support/notifications/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/priority` | POST | `api/admin/support/priority/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/reply` | POST | `api/admin/support/reply/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/support.tsx` | wired |
| `/api/admin/support/routing` | GET | `api/admin/support/routing/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/routing` | POST | `api/admin/support/routing/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/stats` | GET | `api/admin/support/stats/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/support/status` | POST | `api/admin/support/status/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/support.tsx` | wired |
| `/api/admin/tickets` | GET | `api/admin/tickets/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/tickets/:ticketId/replies` | GET | `api/admin/tickets/[ticketId]/replies/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/tickets/:ticketId/reply` | POST | `api/admin/tickets/[ticketId]/reply/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |

## Admin - Security & Monitoring

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/admin/audit` | GET | `api/admin/audit/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/audit.tsx` | wired |
| `/api/admin/config` | GET | `api/admin/config/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/config.tsx` | wired |
| `/api/admin/config` | POST | `api/admin/config/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | `src/pages/admin/config.tsx` | wired |
| `/api/admin/developer` | GET | `api/admin/developer/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/developer.tsx` | wired |
| `/api/admin/env-report` | GET | `api/admin/env-report/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/readiness.tsx` | wired |
| `/api/admin/health` | GET | `api/admin/health/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/security.tsx` | wired |
| `/api/admin/readiness` | GET | `api/admin/readiness/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/readiness.tsx` | wired |
| `/api/admin/reports` | GET | `api/admin/reports/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/reports.tsx` | wired |
| `/api/admin/security/alerts` | GET | `api/admin/security/alerts/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/security/alerts` | POST | `api/admin/security/alerts/POST.ts` | admin-session (requireAdminAuth) | requireRole('SECURITY_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/admin/security/devices` | DELETE | `api/admin/security/devices/DELETE.ts` | admin-session (requireAdminAuth) | requireRole('SECURITY_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/admin/security/devices` | GET | `api/admin/security/devices/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/security/export` | GET | `api/admin/security/export/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/security.tsx` | wired |
| `/api/admin/security/ip-lists` | GET | `api/admin/security/ip-lists/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/security/ip-lists` | POST | `api/admin/security/ip-lists/POST.ts` | admin-session (requireAdminAuth) | requireRole('SECURITY_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/admin/security/rate-limits` | GET | `api/admin/security/rate-limits/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/security/rate-limits` | POST | `api/admin/security/rate-limits/POST.ts` | admin-session (requireAdminAuth) | requireRole('SECURITY_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/admin/security/roles` | GET | `api/admin/security/roles/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/security/roles` | POST | `api/admin/security/roles/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | no frontend caller found | backend-only/unused |
| `/api/admin/security/sessions` | DELETE | `api/admin/security/sessions/DELETE.ts` | admin-session (requireAdminAuth) | requireRole('SECURITY_ADMIN') | `src/pages/admin/security.tsx` | wired |
| `/api/admin/security/sessions` | GET | `api/admin/security/sessions/GET.ts` | admin-session (requireAdminAuth) | requireRole('SECURITY_ADMIN') | `src/pages/admin/security.tsx` | wired |
| `/api/admin/security/sessions` | PATCH | `api/admin/security/sessions/PATCH.ts` | admin-session (requireAdminAuth) | requireRole('SECURITY_ADMIN') | `src/pages/admin/security.tsx` | wired |
| `/api/admin/security/threats` | GET | `api/admin/security/threats/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/security.tsx`, `src/pages/admin/compliance.tsx` | wired |
| `/api/admin/security/threats` | PATCH | `api/admin/security/threats/PATCH.ts` | admin-session (requireAdminAuth) | requireRole('SECURITY_ADMIN') | `src/pages/admin/security.tsx`, `src/pages/admin/compliance.tsx` | wired |
| `/api/admin/security/two-fa` | GET | `api/admin/security/two-fa/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/security/two-fa` | POST | `api/admin/security/two-fa/POST.ts` | admin-session (requireAdminAuth) | requireRole('SECURITY_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/admin/settings` | GET | `api/admin/settings/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/settings.tsx` | wired |
| `/api/admin/settings` | POST | `api/admin/settings/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | `src/pages/admin/settings.tsx` | wired |
| `/api/admin/stats` | GET | `api/admin/stats/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/index.tsx`, `src/layouts/AdminLayout.tsx` | wired |

## Newsletter (Admin Campaigns + Public Subscribe)

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/admin/newsletter/campaigns` | GET | `api/admin/newsletter/campaigns/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/newsletter/campaigns` | POST | `api/admin/newsletter/campaigns/POST.ts` | admin-session (requireAdminAuth) | requireRole('SUPPORT_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/admin/newsletter/campaigns` | PUT | `api/admin/newsletter/campaigns/PUT.ts` | admin-session (requireAdminAuth) | requireRole('SUPPORT_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/admin/newsletter/campaigns/duplicate` | POST | `api/admin/newsletter/campaigns/duplicate/POST.ts` | admin-session (requireAdminAuth) | requireRole('SUPPORT_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/admin/newsletter/campaigns/send` | POST | `api/admin/newsletter/campaigns/send/POST.ts` | admin-session (requireAdminAuth) | requireRole('SUPPORT_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/admin/newsletter/subscribers/import` | POST | `api/admin/newsletter/subscribers/import/POST.ts` | admin-session (requireAdminAuth) | requireRole('SUPPORT_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/admin/newsletter/subscribers/unsubscribe` | POST | `api/admin/newsletter/subscribers/unsubscribe/POST.ts` | admin-session (requireAdminAuth) | requireRole('SUPPORT_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/newsletter/send-sequence` | POST | `api/newsletter/send-sequence/POST.ts` | admin-session (requireAdminAuth via app.use) | none beyond auth | `src/pages/admin/newsletter.tsx`, `src/pages/newsletter.tsx` | wired |
| `/api/newsletter/subscribe` | POST | `api/newsletter/subscribe/POST.ts` | public | none beyond auth | `src/layouts/parts/Footer.tsx` | wired |
| `/api/newsletter/subscribers` | GET | `api/newsletter/subscribers/GET.ts` | admin-session (requireAdminAuth via app.use) | none beyond auth | `src/pages/admin/newsletter.tsx`, `src/pages/newsletter.tsx` | wired |
| `/api/newsletter/unsubscribe` | GET | `api/newsletter/unsubscribe/GET.ts` | public | none beyond auth | no frontend caller found | backend-only/unused |

## Admin - Integrations, Chatbot, Contacts & Zoho

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/admin/chatbot` | GET | `api/admin/chatbot/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/chatbot.tsx` | wired |
| `/api/admin/chatbot` | POST | `api/admin/chatbot/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/chatbot.tsx` | wired |
| `/api/admin/contacts` | GET | `api/admin/contacts/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/contacts.tsx` | wired |
| `/api/admin/integrations` | GET | `api/admin/integrations/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/integrations.tsx` | wired |
| `/api/admin/integrations` | POST | `api/admin/integrations/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | `src/pages/admin/integrations.tsx` | wired |
| `/api/admin/integrations/test` | POST | `api/admin/integrations/test/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/integrations.tsx` | wired |
| `/api/admin/zoho/exchange` | POST | `api/admin/zoho/exchange/POST.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/zoho-setup.tsx` | wired |
| `/api/admin/zoho/oauth/callback` | GET | `api/admin/zoho/oauth/callback/GET.ts` | public (excluded from admin-session gate) | none beyond auth | no frontend caller found | backend-only/unused |

## Customer - Profile, Devices & Notifications

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/users/avatar` | POST | `api/users/avatar/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/profile.tsx` | wired |
| `/api/users/devices` | GET | `api/users/devices/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/devices.tsx` | wired |
| `/api/users/devices/revoke` | POST | `api/users/devices/revoke/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/devices.tsx` | wired |
| `/api/users/me` | PATCH | `api/users/me/PATCH.ts` | customer-bearer (manual, in-handler) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/users/notifications` | GET | `api/users/notifications/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/notifications.tsx` | wired |
| `/api/users/notifications/delete` | POST | `api/users/notifications/delete/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/notifications.tsx` | wired |
| `/api/users/notifications/preferences` | GET | `api/users/notifications/preferences/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/settings.tsx`, `src/pages/dashboard/notifications.tsx` | wired |
| `/api/users/notifications/preferences` | POST | `api/users/notifications/preferences/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/settings.tsx`, `src/pages/dashboard/notifications.tsx` | wired |
| `/api/users/notifications/read` | POST | `api/users/notifications/read/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/notifications.tsx` | wired |
| `/api/users/profile` | GET | `api/users/profile/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/profile.tsx` | wired |
| `/api/users/profile` | PUT | `api/users/profile/PUT.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/profile.tsx` | wired |
| `/api/users/security/events` | GET | `api/users/security/events/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/security.tsx` | wired |
| `/api/users/security/sessions` | GET | `api/users/security/sessions/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/security.tsx` | wired |
| `/api/users/security/sessions/revoke` | POST | `api/users/security/sessions/revoke/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/security.tsx` | wired |

## Customer - Banking (Balances, Transfers, Deposits)

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/users/balance` | GET | `api/users/balance/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/analytics.tsx`, `src/pages/dashboard/transfers.tsx` | wired |
| `/api/users/beneficiaries` | GET | `api/users/beneficiaries/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/beneficiaries.tsx`, `src/pages/dashboard/transfers.tsx` | wired |
| `/api/users/beneficiaries/add` | POST | `api/users/beneficiaries/add/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/beneficiaries.tsx` | wired |
| `/api/users/beneficiaries/delete` | POST | `api/users/beneficiaries/delete/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/beneficiaries.tsx` | wired |
| `/api/users/beneficiaries/update` | POST | `api/users/beneficiaries/update/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/beneficiaries.tsx` | wired |
| `/api/users/deposit` | POST | `api/users/deposit/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/deposits.tsx` | wired |
| `/api/users/swap` | POST | `api/users/swap/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/users/transactions` | GET | `api/users/transactions/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard.tsx`, `src/pages/dashboard/analytics.tsx`, `src/pages/dashboard/deposits.tsx`, `src/pages/dashboard/statements.tsx`, `src/pages/dashboard/transfers.tsx` | wired |
| `/api/users/transfer` | POST | `api/users/transfer/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/users/transfers` | GET | `api/users/transfers/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/transfers.tsx` | wired |
| `/api/users/transfers` | POST | `api/users/transfers/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/transfers.tsx` | wired |
| `/api/users/wallet-overview` | GET | `api/users/wallet-overview/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/deposits.tsx`, `src/pages/dashboard/wallets.tsx` | wired |
| `/api/users/withdraw` | POST | `api/users/withdraw/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | no frontend caller found | backend-only/unused |

## Customer - Cards

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/users/cards` | GET | `api/users/cards/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/cards.tsx` | wired |
| `/api/users/cards/delete` | POST | `api/users/cards/delete/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/users/cards/freeze` | POST | `api/users/cards/freeze/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/cards.tsx` | wired |
| `/api/users/cards/generate` | POST | `api/users/cards/generate/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/cards.tsx` | wired |
| `/api/users/cards/request` | POST | `api/users/cards/request/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/cards.tsx` | wired |

## Customer - Trading

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/users/trading/alerts` | GET | `api/users/trading/alerts/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/trading/watchlist.tsx`, `src/pages/dashboard/trading/chart.tsx` | wired |
| `/api/users/trading/alerts` | POST | `api/users/trading/alerts/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/trading/watchlist.tsx`, `src/pages/dashboard/trading/chart.tsx` | wired |
| `/api/users/trading/analytics` | GET | `api/users/trading/analytics/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/trading/analytics.tsx` | wired |
| `/api/users/trading/history` | GET | `api/users/trading/history/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/trading/trades.tsx` | wired |
| `/api/users/trading/market-data` | GET | `api/users/trading/market-data/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/users/trading/orders` | GET | `api/users/trading/orders/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/trading/orders.tsx`, `src/pages/dashboard/trading/chart.tsx`, `src/pages/dashboard/trading/spot.tsx` | wired |
| `/api/users/trading/orders` | POST | `api/users/trading/orders/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/trading/orders.tsx`, `src/pages/dashboard/trading/chart.tsx`, `src/pages/dashboard/trading/spot.tsx` | wired |
| `/api/users/trading/orders/cancel` | POST | `api/users/trading/orders/cancel/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/trading/orders.tsx` | wired |
| `/api/users/trading/portfolio` | GET | `api/users/trading/portfolio/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/trading.tsx` | wired |
| `/api/users/trading/summary` | GET | `api/users/trading/summary/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/trading.tsx` | wired |
| `/api/users/trading/watchlist` | GET | `api/users/trading/watchlist/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/trading/watchlist.tsx`, `src/pages/dashboard/trading/chart.tsx` | wired |
| `/api/users/trading/watchlist` | POST | `api/users/trading/watchlist/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/trading/watchlist.tsx`, `src/pages/dashboard/trading/chart.tsx` | wired |

## Customer - KYC & Support

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/users/kyc-document` | POST | `api/users/kyc-document/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/users/support` | GET | `api/users/support/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/support.tsx` | wired |
| `/api/users/support` | POST | `api/users/support/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/support.tsx` | wired |
| `/api/users/tickets` | POST | `api/users/tickets/POST.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/kyc.tsx` | wired |

## Analytics (admin-gated tracking API)

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/analytics/ab-results` | GET | `api/analytics/ab-results/GET.ts` | admin-session (requireAdminAuth via app.use('/api/analytics')) | none beyond auth | `src/pages/analytics.tsx` | wired |
| `/api/analytics/conversions` | GET | `api/analytics/conversions/GET.ts` | admin-session (requireAdminAuth via app.use('/api/analytics')) | none beyond auth | `src/pages/analytics.tsx` | wired |
| `/api/analytics/event` | POST | `api/analytics/event/POST.ts` | public | none beyond auth | `src/lib/useABTest.ts`, `src/lib/useAnalytics.ts` | wired |
| `/api/analytics/summary` | GET | `api/analytics/summary/GET.ts` | admin-session (requireAdminAuth via app.use('/api/analytics')) | none beyond auth | `src/pages/analytics.tsx` | wired |

## Market Data

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/market/candles` | GET | `api/market/candles/GET.ts` | public | none beyond auth | `src/hooks/useMarketData.ts` | wired |
| `/api/market/orderbook` | GET | `api/market/orderbook/GET.ts` | public | none beyond auth | `src/hooks/useMarketData.ts` | wired |
| `/api/market/providers` | GET | `api/market/providers/GET.ts` | public | none beyond auth | `src/hooks/useMarketData.ts` | wired |
| `/api/market/search` | GET | `api/market/search/GET.ts` | public | none beyond auth | `src/hooks/useMarketData.ts` | wired |
| `/api/market/summary` | GET | `api/market/summary/GET.ts` | public | none beyond auth | `src/hooks/useMarketData.ts` | wired |
| `/api/market/ticker` | GET | `api/market/ticker/GET.ts` | public | none beyond auth | `src/lib/useMarketWebSocket.ts` | wired |

## Zoho OAuth (public-facing)

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/zoho/callback` | GET | `api/zoho/callback/GET.ts` | public | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/zoho/connect` | GET | `api/zoho/connect/GET.ts` | public | none beyond auth | `src/pages/admin/zoho-setup.tsx (href link)` | wired |
| `/api/zoho/status` | GET | `api/zoho/status/GET.ts` | public | none beyond auth | no frontend caller found | backend-only/unused |

## Public - Marketing, Content & Utility

| ROUTE | METHOD | SOURCE FILE | AUTH | AUTHZ | FRONTEND CALLER | STATUS |
|---|---|---|---|---|---|---|
| `/api/accounts/apply` | POST | `api/accounts/apply/POST.ts` | public | none beyond auth | `src/components/AccountOpeningModal.tsx` | wired |
| `/api/admin/notifications/send` | POST | `api/admin/notifications/send/POST.ts` | admin-session (requireAdminAuth) | requireRole('SUPPORT_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/admin/users` | GET | `api/admin/users/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | `src/pages/admin/users.tsx` | wired |
| `/api/admin/users/:id/audit` | GET | `api/admin/users/[id]/audit/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/users/:id/devices` | GET | `api/admin/users/[id]/devices/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/users/:id/login-history` | GET | `api/admin/users/[id]/login-history/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/users/:id/security-events` | GET | `api/admin/users/[id]/security-events/GET.ts` | admin-session (requireAdminAuth) | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/admin/users/action` | POST | `api/admin/users/action/POST.ts` | admin-session (requireAdminAuth) | requireRole('COMPLIANCE_ADMIN') | `src/pages/admin/users.tsx` | wired |
| `/api/admin/users/approve` | POST | `api/admin/users/approve/POST.ts` | admin-session (requireAdminAuth) | requireRole('COMPLIANCE_ADMIN') | `src/pages/admin/users.tsx` | wired |
| `/api/admin/users/create` | POST | `api/admin/users/create/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | no frontend caller found | backend-only/unused |
| `/api/admin/users/currency` | POST | `api/admin/users/currency/POST.ts` | admin-session (requireAdminAuth) | requireRole('FINANCE_ADMIN') | no frontend caller found | backend-only/unused |
| `/api/admin/users/delete` | POST | `api/admin/users/delete/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | no frontend caller found | backend-only/unused |
| `/api/admin/users/edit` | POST | `api/admin/users/edit/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | `src/components/admin/ClientEditModal.tsx` | wired |
| `/api/admin/users/override` | POST | `api/admin/users/override/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | `src/pages/admin/smtp.tsx` | wired |
| `/api/admin/users/reject` | POST | `api/admin/users/reject/POST.ts` | admin-session (requireAdminAuth) | requireRole('COMPLIANCE_ADMIN') | `src/pages/admin/users.tsx` | wired |
| `/api/admin/users/reset-2fa` | POST | `api/admin/users/reset-2fa/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | no frontend caller found | backend-only/unused |
| `/api/admin/users/reset-password` | POST | `api/admin/users/reset-password/POST.ts` | admin-session (requireAdminAuth) | requireSuperAdmin | no frontend caller found | backend-only/unused |
| `/api/chat` | POST | `api/chat/POST.ts` | public | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/cms/content` | GET | `api/cms/content/GET.ts` | public | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/config/smartsupp-key` | GET | `api/config/smartsupp-key/GET.ts` | public | none beyond auth | `src/components/SmartsuppWidget.tsx` | wired |
| `/api/contact` | POST | `api/contact/POST.ts` | public | none beyond auth | `src/pages/contact.tsx` | wired |
| `/api/csrf` | GET | `api/csrf/GET.ts` | public | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/health` | GET | `api/health/GET.ts` | public | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/og` | GET | `api/og/GET.ts` | public | none beyond auth | `src/pages/*.tsx (og:image / twitter:image meta tags, many pages)` | wired |
| `/api/settings/rates` | GET | `api/settings/rates/GET.ts` | public | none beyond auth | `src/pages/dashboard/rates.tsx` | wired |
| `/api/settings/social` | GET | `api/settings/social/GET.ts` | public | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/test-email` | POST | `api/test-email/POST.ts` | public | none beyond auth | no frontend caller found | backend-only/unused |
| `/api/users/login-history` | GET | `api/users/login-history/GET.ts` | customer-bearer (manual, in-handler) | none beyond auth | `src/pages/dashboard/security.tsx` | wired |
---

## Suspicious Findings (frontend/backend mismatches)

Import/registration integrity is clean: 289 `import` statements in `entry.ts`, 289 `app.<method>()` registrations, every imported handler file exists on disk, and no method+path pair is registered twice. Nothing is "dead" in the sense of a registration whose handler doesn't resolve. However, three genuine frontend/backend contract breaks were found — the frontend calls a URL that **no registered route matches**, meaning these calls 404 in production:

1. **KYC upload flow is completely disconnected.** `src/pages/kyc.tsx` calls three endpoints that do not exist anywhere in `entry.ts`:
   - `GET /api/users/kyc/status`
   - `POST /api/users/kyc/upload-url`
   - `POST /api/users/kyc/submit`

   Meanwhile the one KYC route that *is* registered, `POST /api/users/kyc-document`, has no frontend caller at all. This looks like the customer-facing KYC page was built against a different (never-implemented) API shape than the one actually wired up in `entry.ts` — the customer KYC document upload journey is broken end-to-end.

2. **`src/pages/admin/EmailDiagnostics.tsx`** calls `GET /api/admin/email/health`, which is not registered. Only `GET /api/admin/health` exists. The admin Email Diagnostics page's health check will 404.

3. **`src/pages/admin/security.tsx`** calls `GET /api/admin/security/logs` (for both the "login logs" and "HTTP logs" tabs), which is not registered. The closest registered routes are `/api/admin/security/rate-limits`, `/api/admin/security/alerts`, `/api/admin/security/threats`, etc. — none of them serve raw login/HTTP logs. This panel of the admin Security page is non-functional against the current backend.

None of the three above show up as "backend-only/unused" in the tables — they simply aren't in the table at all, because there's no matching registration; they're listed under the nearest logically-related route's row context above but are flagged here explicitly since they're the real bugs.

No duplicate `(method, path)` registrations were found, and no imported handler file was missing from disk.
