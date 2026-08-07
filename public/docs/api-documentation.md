# City Gate Capital — API & Route Documentation

> Generated: 2026-06-04  
> Base URL: `https://citygate.capital`

---

## Table of Contents

1. [Frontend Page Routes](#frontend-page-routes)
2. [Public API Endpoints](#public-api-endpoints)
3. [Customer API Endpoints](#customer-api-endpoints)
4. [Admin API Endpoints](#admin-api-endpoints)
5. [Rate Limits](#rate-limits)
6. [Authentication](#authentication)

---

## Frontend Page Routes

### Public Pages

| Route | Description | Auth |
|---|---|---|
| `GET /` | Homepage | Public |
| `GET /about` | About City Gate Capital | Public |
| `GET /digital-banking` | Digital banking feature page | Public |
| `GET /accounts` | Account types & pricing | Public |
| `GET /support` | Help & support centre | Public |
| `GET /contact` | Contact page | Public |
| `GET /privacy-policy` | Privacy policy | Public |
| `GET /terms-of-service` | Terms of service | Public |
| `GET /cookie-policy` | Cookie policy | Public |
| `GET /compliance` | Compliance & regulation | Public |

### Customer Auth Pages

| Route | Description | Auth |
|---|---|---|
| `GET /login` | Customer login | Public |
| `GET /register` | Customer registration | Public |
| `GET /forgot-password` | Password reset request | Public |
| `GET /reset-password` | Password reset (token in query) | Public |
| `GET /dashboard` | Customer dashboard | Customer Auth |
| `GET /wallet` | Wallet & balances | Customer Auth |
| `GET /transfers` | Transfers & payments | Customer Auth |
| `GET /kyc` | KYC verification flow | Customer Auth |

### Admin Pages

| Route | Description | Auth |
|---|---|---|
| `GET /admin/login` | Admin login | Public |
| `GET /admin/forgot-password` | Admin password reset request | Public |
| `GET /admin/reset-password` | Admin password reset (token in query) | Public |
| `GET /admin` | Admin dashboard | Admin Auth |
| `GET /admin/users` | User management | Admin Auth |
| `GET /admin/transactions` | Transaction management | Admin Auth |
| `GET /admin/banking` | Banking operations | Admin Auth |
| `GET /admin/crypto` | Crypto wallet management | Admin Auth |
| `GET /admin/kyc` | KYC review queue | Admin Auth |
| `GET /admin/support` | Support ticket management | Admin Auth |
| `GET /admin/security` | Security monitoring | Admin Auth |
| `GET /admin/rates` | Exchange rates & fees | Admin Auth |
| `GET /admin/cms` | Content management | Admin Auth |
| `GET /admin/newsletter` | Newsletter management | Admin Auth |
| `GET /admin/smtp` | SMTP / email configuration | Admin Auth |
| `GET /admin/contacts` | Contact form submissions | Admin Auth |
| `GET /admin/social` | Social media settings | Admin Auth |
| `GET /admin/chatbot` | Chatbot configuration | Admin Auth |
| `GET /admin/links` | External links management | Admin Auth |
| `GET /admin/website` | Website settings | Admin Auth |
| `GET /admin/settings` | Admin settings | Admin Auth |
| `GET /admin/documentation` | API documentation downloads | Admin Auth |

---

## Public API Endpoints

| Route | Method | Description | Auth | Rate Limit |
|---|---|---|---|---|
| `/api/health` | GET | Server health check | Public | Global 200/min |
| `/api/csrf` | GET | Get CSRF token | Public | Global 200/min |
| `/api/og` | GET | Open Graph image generator | Public | Global 200/min |
| `/api/cms/content` | GET | Public CMS content (60s cache) | Public | Global 200/min |
| `/api/settings/rates` | GET | Public exchange rates & fees | Public | Global 200/min |
| `/api/settings/social` | GET | Public social media links | Public | Global 200/min |
| `/api/contact` | POST | Submit contact form | Public | 10/hr/IP |
| `/api/newsletter/subscribe` | POST | Subscribe to newsletter | Public | 5/hr/IP |
| `/api/newsletter/unsubscribe` | GET | Unsubscribe from newsletter | Public | Global 200/min |
| `/api/accounts/apply` | POST | Submit account application | Public | 3/hr/IP |
| `/api/analytics/event` | POST | Track analytics event (telemetry) | Public | Global 200/min |
| `/unsubscribe` | GET | Newsletter unsubscribe (alias) | Public | Global 200/min |
| `/robots.txt` | GET | Robots.txt | Public | — |
| `/sitemap.xml` | GET | XML sitemap | Public | — |

---

## Customer API Endpoints

All customer endpoints require a valid customer session cookie (`cgc_customer_token`).

### Authentication

| Route | Method | Description | Auth | Rate Limit |
|---|---|---|---|---|
| `/api/users/register` | POST | Register new customer account | Public | 5/hr/IP |
| `/api/users/verify-email` | GET | Verify email address (token in query) | Public | Global 200/min |
| `/api/users/login` | POST | Customer login | Public | 5/15min/IP |
| `/api/users/session` | GET | Get current session / verify token | Customer Auth | Global 200/min |
| `/api/users/logout` | POST | Logout customer | Customer Auth | Global 200/min |
| `/api/users/password-reset` | POST | Request password reset email | Public | 5/15min/IP |
| `/api/users/password-reset/confirm` | POST | Confirm password reset with token | Public | 5/15min/IP |

### Profile

| Route | Method | Description | Auth | Rate Limit |
|---|---|---|---|---|
| `/api/users/me` | PATCH | Update customer profile | Customer Auth | Global 200/min |
| `/api/users/avatar` | POST | Upload profile avatar | Customer Auth | Global 200/min |
| `/api/users/kyc-document` | POST | Upload KYC document | Customer Auth | Global 200/min |

### Balances & Wallets

| Route | Method | Description | Auth | Rate Limit |
|---|---|---|---|---|
| `/api/users/balance` | GET | Get wallet balances (all currencies) | Customer Auth | Global 200/min |

### Transactions

| Route | Method | Description | Auth | Rate Limit |
|---|---|---|---|---|
| `/api/users/transactions` | GET | Get transaction history | Customer Auth | Global 200/min |
| `/api/users/transfer` | POST | Initiate a transfer | Customer Auth | Global 200/min |
| `/api/users/deposit` | POST | Initiate a deposit | Customer Auth | Global 200/min |
| `/api/users/withdraw` | POST | Initiate a withdrawal | Customer Auth | Global 200/min |
| `/api/users/swap` | POST | Currency swap / exchange | Customer Auth | Global 200/min |

### Virtual Cards

| Route | Method | Description | Auth | Rate Limit |
|---|---|---|---|---|
| `/api/users/cards` | GET | List customer's virtual cards | Customer Auth | Global 200/min |
| `/api/users/cards/generate` | POST | Generate a new virtual card | Customer Auth | Global 200/min |
| `/api/users/cards/freeze` | POST | Freeze / unfreeze a card | Customer Auth | Global 200/min |
| `/api/users/cards/delete` | POST | Delete a virtual card | Customer Auth | Global 200/min |

### Notifications

| Route | Method | Description | Auth | Rate Limit |
|---|---|---|---|---|
| `/api/users/notifications` | GET | Get customer notifications | Customer Auth | Global 200/min |
| `/api/users/notifications/read` | POST | Mark notifications as read | Customer Auth | Global 200/min |

### Support

| Route | Method | Description | Auth | Rate Limit |
|---|---|---|---|---|
| `/api/users/support` | GET | Get customer's support tickets | Customer Auth | Global 200/min |
| `/api/users/support` | POST | Submit a new support ticket | Customer Auth | Global 200/min |

---

## Admin API Endpoints

All admin endpoints (except auth) require a valid admin session. Auth is resolved from HttpOnly cookie `cgc_admin_sid` OR `Authorization: Bearer <token>` header.

### Admin Authentication (Public — no session required)

| Route | Method | Description | Rate Limit |
|---|---|---|---|
| `/api/admin/auth/login` | POST | Admin login (password) | 5/15min/IP |
| `/api/admin/auth/otp/verify` | POST | Verify OTP / 2FA code | 5/15min/IP |
| `/api/admin/auth/password-reset` | POST | Request admin password reset | 3/15min/IP |
| `/api/admin/auth/password-reset/confirm` | POST | Confirm admin password reset | 5/15min/IP |
| `/api/admin/auth/verify` | GET | Verify existing admin session | Global 200/min |
| `/api/admin/auth/logout` | POST | Logout admin session | Global 200/min |
| `/api/admin/auth/unlock` | POST | Unlock admin account | Global 200/min |
| `/api/admin/auth/trusted-devices` | GET | List trusted devices | Global 200/min |
| `/api/admin/auth/trusted-devices` | DELETE | Remove trusted device | Global 200/min |
| `/api/admin/auth/diag` | GET | Auth diagnostics (dev only) | Global 200/min |

### Dashboard & Health

| Route | Method | Description |
|---|---|---|
| `/api/admin/health` | GET | Admin health check |
| `/api/admin/stats` | GET | Dashboard KPIs, revenue, activity |

### Users

| Route | Method | Description |
|---|---|---|
| `/api/admin/users` | GET | List / search users |
| `/api/admin/users/action` | POST | Suspend / activate / delete user |
| `/api/admin/users/approve` | POST | Approve pending user |
| `/api/admin/users/reject` | POST | Reject pending user |
| `/api/admin/users/override` | POST | Override user data |
| `/api/admin/users/edit` | POST | Edit user profile |
| `/api/admin/users/currency` | POST | Set user's primary currency |

### Transactions & Banking

| Route | Method | Description |
|---|---|---|
| `/api/admin/transactions` | GET | List all transactions (legacy) |
| `/api/admin/transactions/real` | GET | List real transactions with filters |
| `/api/admin/transactions/create` | POST | Create manual transaction |
| `/api/admin/transactions/approve` | POST | Approve pending transaction |
| `/api/admin/transactions/reject` | POST | Reject pending transaction |
| `/api/admin/transactions/freeze` | POST | Freeze transaction |

### Balance Management

| Route | Method | Description |
|---|---|---|
| `/api/admin/balance/adjust` | POST | Adjust user balance |
| `/api/admin/balance/history` | GET | Balance adjustment history |

### Crypto Wallets

| Route | Method | Description |
|---|---|---|
| `/api/admin/wallets` | GET | List all crypto wallets |
| `/api/admin/wallets` | PATCH | Update wallet address / balance |

### KYC Management

| Route | Method | Description |
|---|---|---|
| `/api/admin/kyc/stats` | GET | KYC statistics |
| `/api/admin/kyc/queue` | GET | Pending KYC submissions |
| `/api/admin/kyc/settings` | GET | KYC expiry settings |
| `/api/admin/kyc/settings` | POST | Update KYC expiry settings |
| `/api/admin/kyc/approve` | POST | Approve KYC submission |
| `/api/admin/kyc/reject` | POST | Reject KYC submission |
| `/api/admin/kyc/request-info` | POST | Request additional info from user |
| `/api/admin/kyc/flag` | POST | Flag KYC submission |
| `/api/admin/kyc/extend` | POST | Extend KYC expiry |
| `/api/admin/kyc/note` | POST | Add internal note to KYC |

### Security

| Route | Method | Description |
|---|---|---|
| `/api/admin/security/logs` | GET | Login & HTTP access logs (type=login\|http) |
| `/api/admin/security/sessions` | GET | Active admin sessions |
| `/api/admin/security/sessions` | DELETE | Terminate admin session |
| `/api/admin/security/sessions/:token` | PATCH | Update session metadata |
| `/api/admin/security/threats` | GET | Security threat flags |
| `/api/admin/security/threats` | PATCH | Resolve / update threat flag |
| `/api/admin/security/export` | GET | Export security data |

### Support Tickets

| Route | Method | Description |
|---|---|---|
| `/api/admin/support` | GET | List all support tickets |
| `/api/admin/support/stats` | GET | Support statistics |
| `/api/admin/support/reply` | POST | Reply to a ticket |
| `/api/admin/support/status` | POST | Change ticket status |
| `/api/admin/support/bulk` | POST | Bulk actions on tickets |
| `/api/admin/support/assign` | POST | Assign ticket to agent |
| `/api/admin/support/note` | POST | Add internal note to ticket |
| `/api/admin/support/priority` | POST | Set ticket priority |
| `/api/admin/support/canned` | GET | Get canned responses |
| `/api/admin/support/canned` | POST | Create canned response |
| `/api/admin/support/canned` | PUT | Update canned response |
| `/api/admin/support/canned` | DELETE | Delete canned response |
| `/api/admin/support/routing` | GET | Get routing rules |
| `/api/admin/support/routing` | POST | Update routing rules |
| `/api/admin/support/notifications` | GET | Support notification settings |
| `/api/admin/support/notifications` | POST | Update notification settings |
| `/api/admin/tickets` | GET | List tickets (legacy) |
| `/api/admin/tickets/:ticketId/reply` | POST | Reply to ticket (legacy) |
| `/api/admin/tickets/:ticketId/replies` | GET | Get ticket replies (legacy) |

### Rates & Fees

| Route | Method | Description |
|---|---|---|
| `/api/admin/rates` | GET | Get all rates & fee config |
| `/api/admin/rates/tx-fees` | POST | Set transaction fees |
| `/api/admin/rates/fx-markup` | POST | Set FX markup |
| `/api/admin/rates/tier-fees` | POST | Set tier-based fees |
| `/api/admin/rates/limits` | POST | Set withdrawal limits |
| `/api/admin/rates/fee-history` | GET | Fee change history |
| `/api/admin/rates/limits/user` | GET | Per-user withdrawal limits |
| `/api/admin/settings/rates` | GET | Rates settings (legacy) |
| `/api/admin/settings/rates` | POST | Update rates settings (legacy) |

### CMS & Content

| Route | Method | Description |
|---|---|---|
| `/api/admin/cms` | GET | Get full CMS content |
| `/api/admin/cms` | POST | Update CMS content |
| `/api/admin/contacts` | GET | Contact form submissions |
| `/api/admin/social` | GET | Social media settings |
| `/api/admin/social` | POST | Update social media settings |
| `/api/admin/chatbot` | GET | Chatbot configuration |
| `/api/admin/chatbot` | POST | Update chatbot configuration |
| `/api/admin/links` | GET | External links |
| `/api/admin/links` | POST | Update external links |
| `/api/admin/website` | GET | Website settings |
| `/api/admin/website` | POST | Update website settings |

### Email & SMTP

| Route | Method | Description |
|---|---|---|
| `/api/admin/smtp/status` | GET | SMTP / email transport status |
| `/api/admin/smtp/config` | GET | SMTP configuration |
| `/api/admin/smtp/config` | POST | Update SMTP configuration |
| `/api/admin/smtp/verify` | POST | Verify SMTP connection |
| `/api/admin/smtp/test` | POST | Send test email |
| `/api/admin/smtp/mode` | POST | Switch email transport mode |
| `/api/admin/smtp/test-template` | POST | Send test email using template |
| `/api/admin/email/test` | POST | Send test email (alias) |
| `/api/admin/email/queue` | GET | Email queue |
| `/api/admin/email/queue/retry` | POST | Retry failed email |
| `/api/admin/email/queue/:id` | DELETE | Delete queued email |
| `/api/admin/email/flush` | POST | Flush email queue |
| `/api/admin/email/purge` | POST | Purge email queue |
| `/api/admin/email/requeue` | POST | Requeue failed emails |
| `/api/admin/email/status` | GET | Email system status |
| `/api/admin/email/templates` | GET | Email templates |
| `/api/admin/email/templates` | POST | Update email template |
| `/api/admin/email/templates/reset` | POST | Reset template to default |
| `/api/admin/email/log` | GET | Email delivery log |
| `/api/admin/smtp/queue` | GET | Email queue (legacy alias) |

### Newsletter

| Route | Method | Description |
|---|---|---|
| `/api/newsletter/subscribers` | GET | List subscribers (admin) |
| `/api/newsletter/send-sequence` | POST | Send email sequence |
| `/api/admin/newsletter/campaigns` | GET | List campaigns |
| `/api/admin/newsletter/campaigns` | POST | Create campaign |
| `/api/admin/newsletter/campaigns` | PUT | Update campaign |
| `/api/admin/newsletter/campaigns/duplicate` | POST | Duplicate campaign |
| `/api/admin/newsletter/campaigns/send` | POST | Send / schedule campaign |
| `/api/admin/newsletter/subscribers/unsubscribe` | POST | Unsubscribe subscriber |
| `/api/admin/newsletter/subscribers/import` | POST | Import subscribers from CSV |

### Notifications

| Route | Method | Description |
|---|---|---|
| `/api/admin/notifications/send` | POST | Send push notification to user(s) |

### Analytics

| Route | Method | Description |
|---|---|---|
| `/api/analytics/summary` | GET | Analytics summary (admin) |
| `/api/analytics/conversions` | GET | Conversion analytics (admin) |
| `/api/analytics/ab-results` | GET | A/B test results (admin) |

### Settings

| Route | Method | Description |
|---|---|---|
| `/api/admin/settings` | GET | Admin platform settings |
| `/api/admin/settings` | POST | Update admin platform settings |
| `/api/admin/audit` | GET | Audit log |

### Zoho OAuth

| Route | Method | Description | Auth |
|---|---|---|---|
| `/api/zoho/connect` | GET | Initiate Zoho OAuth flow | Public |
| `/api/zoho/callback` | GET | Zoho OAuth callback | Public |
| `/api/zoho/status` | GET | Zoho credential status | Admin Auth |
| `/api/admin/zoho/oauth/callback` | GET | Admin Zoho OAuth callback | Admin Auth |

### Test / Dev

| Route | Method | Description | Auth |
|---|---|---|---|
| `/api/test-email` | POST | Send test email | Admin Auth, 10/hr/IP |

---

## Rate Limits

| Limit Key | Window | Max Requests | Applied To |
|---|---|---|---|
| Global API | 1 min | 200/IP | All `/api/*` routes |
| Auth | 15 min | 5/IP | Login, session verify |
| Admin password reset | 15 min | 3/IP | `/api/admin/auth/password-reset` |
| Admin reset confirm | 15 min | 5/IP | `/api/admin/auth/password-reset/confirm` |
| Registration | 1 hr | 5/IP | `/api/users/register` |
| Contact form | 1 hr | 10/IP | `/api/contact` |
| Newsletter subscribe | 1 hr | 5/IP | `/api/newsletter/subscribe` |
| Account application | 1 hr | 3/IP | `/api/accounts/apply` |
| Test email | 1 hr | 10/IP | `/api/test-email` |

---

## Authentication

### Customer Authentication
- **Cookie**: `cgc_customer_token` (HttpOnly, SameSite=Strict)
- **Header**: `Authorization: Bearer <token>`
- Session verified via `GET /api/users/session`

### Admin Authentication
- **Cookie**: `cgc_admin_sid` (HttpOnly, SameSite=Strict)
- **Header**: `Authorization: Bearer <token>`
- Session verified via `GET /api/admin/auth/verify`
- Enforces IP + User-Agent fingerprinting, inactivity TTL, and absolute TTL
- Optional OTP / 2FA via `POST /api/admin/auth/otp/verify`

### CSRF Protection
- Required on: `POST /api/contact`, `POST /api/accounts/apply`
- Token obtained from: `GET /api/csrf`
- Sent as: `X-CSRF-Token` header or `_csrf` body field
