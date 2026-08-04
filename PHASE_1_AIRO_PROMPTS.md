# City Gate Capital - Phase 1: Airo Prompts
## Complete Banking Platform Setup Commands

**Environment:** Airo No-Code Builder  
**Status:** Ready for immediate execution  
**Database:** Supabase PostgreSQL  
**Auth:** Supabase Auth (email/password)  
**Secrets Storage:** Airo Secrets Manager  

---

## 1. Banking Operations & Currency Control

**Task:** Core account types, balance management, currency conversion  
**Status:** Critical path

```
Create a banking operations module in Airo with the following:

ENTITIES:
- Account (accountId, userId, accountType, currency, balance, status, createdAt, updatedAt)
  - Account types: Checking, Savings, Money Market, Wallet
  - Currency: USD, EUR, GBP, CAD, AUD (add more as needed)
  - Status: Active, Suspended, Closed
  - Constraints: balance >= 0, unique (userId, accountType, currency)

- CurrencyRate (fromCurrency, toCurrency, rate, timestamp, source)
  - Rate source: Manual (admin), API (third-party), Internal
  - Auto-update timestamp on each rate change
  - Unique constraint: (fromCurrency, toCurrency)

- Transaction (txId, fromAccountId, toAccountId, amount, currency, txType, status, timestamp)
  - Transaction types: Deposit, Withdrawal, Transfer, Exchange, Fee
  - Status: Pending, Completed, Failed, Reversed
  - Immutable after completion (audit trail)

BUSINESS LOGIC:
- Balance calculation: SUM(deposits) - SUM(withdrawals) - SUM(fees)
- Currency conversion: amount * CurrencyRate.rate with 2 decimal precision
- Fee deduction: auto-apply on withdrawal (account type + amount based)
- Transaction atomicity: multi-account transfers fail entirely or succeed entirely

UI COMPONENTS:
- Account summary card (balance in primary currency + 5 alt currencies side-by-side)
- Balance history chart (30-day trend line, switchable by currency)
- Currency selector (dropdown on all balance displays)
- Exchange preview (live rate + fee breakdown before confirmation)

VALIDATION:
- Sufficient balance check before any debit
- Daily withdrawal limits by account type (Checking: $5k, Savings: $10k, etc.)
- Same-day transaction count limits
- Currency conversion rate staleness warning (>1 hour old)

API INTEGRATION:
- FX rate update endpoint (call daily at 2 AM UTC via Render cron)
- Balance sync with Supabase Auth user (cascade delete on user removal)

ERROR HANDLING:
- Insufficient funds → rollback + user notification
- Rate stale → queue for manual retry + alert admin
- Duplicate transaction detection (txId idempotency)
```

---

## 2. Rates & Fees Management

**Task:** Dynamic fee structure, interest accrual, promotional rates  
**Status:** Phase 1 critical

```
Create a rates and fees engine in Airo:

ENTITIES:
- FeeSchedule (scheduleId, accountType, feeType, baseAmount, percentageOfTransaction, conditions, activeFrom, activeTo)
  - Fee types: Monthly Maintenance, ATM Withdrawal, Transfer, Low Balance, Overdraft
  - Percentage-based OR flat-rate fees (or both combined)
  - Conditions: amount ranges, time windows, account age
  - Schedule start/end dates for promotional periods

- InterestRate (rateId, accountType, currency, annualRate, compoundingFrequency, minimumBalance, activeFrom, activeTo)
  - Compounding: Daily, Monthly, Quarterly, Annually
  - Minimum balance triggers (Savings: $1000, Money Market: $5000)
  - Promotional rates with expiration dates

- FeeWaiver (waiverType, eligibilityRule, accountTypes, validFrom, validUntil)
  - Waiver types: MonthlyMaintenanceWaiver, ATMFeeWaiver, TransferFeeWaiver
  - Eligibility: Min balance, Direct deposit, Account age, Premium membership
  - Date ranges for time-limited promotions

BUSINESS LOGIC:
- Monthly fee calculation: apply all applicable fees from FeeSchedule
- Interest accrual: (balance * (annualRate / 365)) compounded per schedule
- Fee waiver eligibility: check against all active waivers, apply highest benefit
- Promotional fee override: override base schedule during promotional period
- Recurring fee application: run daily batch for interest, monthly for maintenance fees

UI COMPONENTS:
- Fee transparency panel: show all applicable fees, eligibility for waivers
- Interest calculator: input balance/account type → show projected annual interest
- Fee schedule admin panel (create/edit/delete fees with date pickers)
- Promotion manager (set promotional rates, waivers, expiration dates)

VALIDATION:
- Fee amounts cannot be negative
- Interest rates cannot exceed regulatory limits (varies by country)
- Overlapping schedules alert admin
- Promotional periods cannot overlap with different promotions on same fee type

REPORTING:
- Monthly fee revenue by fee type
- Interest expense by account type
- Waiver utilization (how many users qualified, how much waived)
- Promotional uptake (users on promotional rates)
```

---

## 3. Support Ticketing System

**Task:** Multi-channel support, ticket routing, SLA tracking  
**Status:** Phase 1 critical

```
Create a support ticketing and case management system in Airo:

ENTITIES:
- SupportTicket (ticketId, userId, subject, description, category, priority, status, channel, assignedTo, createdAt, resolvedAt, slaDeadline)
  - Categories: Account, Transaction, Fees, Technical, Complaint, Other
  - Priority: Low (5 days), Medium (2 days), High (24 hours), Critical (4 hours)
  - Channels: Email, In-app Chat, Phone, Tawk.to
  - Status: Open, In Progress, Pending User, Resolved, Closed
  - SLA deadline: auto-calculated based on priority

- TicketResponse (responseId, ticketId, responderId, message, attachments, timestamp, isInternal)
  - Internal responses: visible to admin only
  - Public responses: visible to customer + admin
  - Attachment support for documents, screenshots

- TicketQueue (queueId, name, assignedAgents, routingRules, slaMultiplier, avgResolutionTime)
  - Routing rules: by category, priority, language, skillset
  - SLA multiplier: adjust base SLA per queue (e.g., Tech Support = 1.5x)

BUSINESS LOGIC:
- Automatic assignment: route based on queue rules + agent availability
- SLA tracking: warn if 75% of deadline passed, escalate if exceeded
- Auto-escalation: High/Critical move to supervisor queue if unresolved after 24 hours
- Duplicate detection: flag similar tickets by content + user
- Response time SLA: first response within priority window
- Resolution closure: require resolution summary + customer satisfaction survey

UI COMPONENTS:
- Customer support portal: submit ticket, view history, add responses
- Agent dashboard: ticket queue view, mass assignment tools, SLA burndown chart
- Ticket detail view: full conversation history, internal notes, customer profile sidebar
- Queue admin: create/edit queues, view queue metrics, manage routing rules
- Knowledge base integration: suggest relevant articles based on ticket content

VALIDATION:
- Ticket subject min 10 chars, max 200
- Description min 20 chars, max 5000
- Attachments: max 10 MB, allowed types (PDF, JPG, PNG, DOC)
- Only ticket creator or assigned agent can respond

INTEGRATIONS:
- Tawk.to webhook: auto-create SupportTicket from chat conversations
- Email forwarding: create ticket from support@citygatecapital.com emails
- Slack notification: post new high-priority tickets to admin channel
- Email notifications: keep customers updated on status changes

REPORTING:
- Average resolution time by category + priority
- SLA compliance rate (% tickets resolved within SLA)
- Agent productivity metrics (tickets resolved/week, avg resolution time)
- Customer satisfaction (survey response rate + CSAT score trends)
```

---

## 4. Security & Compliance Management

**Task:** Session management, rate limiting, audit logging, 2FA  
**Status:** Phase 1 critical

```
Create security and compliance controls in Airo:

ENTITIES:
- UserSession (sessionId, userId, tokenHash, createdAt, expiresAt, lastActivityAt, ipAddress, userAgent, deviceId, isActive)
  - Session timeout: 30 min inactivity (auto-revoke)
  - Max concurrent sessions per user: 2
  - Token hash: SHA-256(JWT token), never store plaintext
  - Device tracking: fingerprint to detect anomalies

- LoginAttempt (attemptId, userId, ipAddress, success, timestamp, reason)
  - Rate limit: 5 failed attempts → 15 min lockout
  - Geo-anomaly detection: flag login from new country
  - Lockout escalation: 3 consecutive lockouts → require 2FA reset

- AuditLog (logId, userId, action, resource, resourceId, oldValue, newValue, timestamp, ipAddress)
  - Actions: Login, Logout, Transfer, WithdrawalRequest, KYCSubmit, SettingsChange
  - Immutable append-only log (no deletes, only reads)
  - Retention: 7 years (regulatory requirement)

- TwoFactorAuth (tfaId, userId, method, secret, backupCodes, enabledAt, disabledAt, verifiedAt)
  - Methods: TOTP (Google Authenticator), SMS, Email
  - Backup codes: 10 single-use codes (regenerable)
  - Enforce 2FA for: transactions >$10k, account changes, password reset

- RateLimitRule (ruleId, endpoint, maxRequests, windowSeconds, byUser, byIP, action)
  - Actions: Throttle (delay response), Block (403), Alert (log + notify admin)
  - Endpoints: /api/transfer, /api/withdraw, /api/login
  - Global + per-user rate limits

BUSINESS LOGIC:
- Session expiry: check lastActivityAt on every request, auto-invalidate if >30 min
- Login attempt tracking: increment counter on failed login, clear on success
- Geo-anomaly: flag login if country differs from last 5 logins (notify user)
- 2FA requirement: enforce for high-risk actions (transaction >$10k, KYC change)
- Audit trail: log all state changes with before/after values
- Rate limiting: check rule before executing action, throttle or block per rule

UI COMPONENTS:
- Security dashboard: active sessions, 2FA status, recent login history, anomaly alerts
- 2FA setup wizard: QR code for TOTP, SMS/email verification, backup code download
- Session management: view all active sessions, revoke remote sessions
- Login attempt history: timestamp, IP, location, success/failure
- Admin audit log viewer: filter by user/action/date, export CSV

VALIDATION:
- Session token format: JWT with HS256 signature (Supabase default)
- 2FA codes: 6-digit TOTP, 30-second window, no reuse
- Backup codes: 8 alphanumeric characters each
- Rate limit thresholds must be non-negative integers

INTEGRATIONS:
- Supabase Auth: token validation, session refresh
- MaxMind GeoIP: geo-anomaly detection on login
- Twilio SMS: 2FA code delivery (if SMS method selected)
- SendGrid Email: 2FA code delivery (if email method selected)

COMPLIANCE:
- PCI DSS: don't log full card numbers, mask to last 4 digits
- GDPR: audit log retention tied to user deletion (7-year hold)
- SOC 2: immutable audit trail with tamper detection
```

---

## 5. KYC (Know Your Customer) Management

**Task:** Identity verification, document collection, compliance checks  
**Status:** Phase 1 critical

```
Create KYC and identity verification module in Airo:

ENTITIES:
- KYCSubmission (submissionId, userId, status, submittedAt, reviewedAt, reviewedBy, verificationLevel)
  - Status: NotStarted, InProgress, PendingReview, Verified, Rejected, Expired
  - Verification levels: Level1 (Basic), Level2 (Enhanced), Level3 (Full)
  - Rejection reasons: InvalidDocument, ExpiredID, FaceMatchFailed, DataInconsistent

- PersonalInfo (infoId, userId, firstName, lastName, dateOfBirth, nationality, ssn, createdAt, updatedAt)
  - Fields immutable after first submission (audit trail of changes)
  - SSN: encrypted at rest, accessible only to compliance team
  - Date of birth: age verification (18+ minimum)

- DocumentSubmission (docId, submissionId, documentType, filename, fileHash, uploadedAt, verificationStatus, ocr)
  - Document types: Passport, DriverLicense, NationalID, UtilityBill, BankStatement
  - File hash: SHA-256 for integrity verification
  - OCR: extracted text from document (searchable, auditable)
  - Verification: Manual (compliance) + Automated (liveness check if photo ID)

- AddressVerification (addressId, userId, street, city, state, zipCode, country, verifiedAt, verificationMethod)
  - Verification methods: UtilityBill, BankStatement, GovernmentDocument, ThirdParty (address API)
  - Proof required for transactions >$3000

- KYCReview (reviewId, submissionId, reviewer, reviewDate, decision, notes, rejectionReason)
  - Decision: Approved, Rejected, MoreInfoNeeded
  - Rejection reason: must cite specific field/document issue
  - Approval: auto-upgrade account tier, notify user

BUSINESS LOGIC:
- Multi-step flow: PersonalInfo → Documents → AddressVerification → KYCReview → Status
- Auto-rejection rules: Expired ID, Age < 18, Mismatched data (name/DOB across docs)
- Re-submission: user can resubmit after rejection, max 3 attempts per 30-day window
- Verification expiry: Level 2/3 require refresh every 3 years
- Risk scoring: assign risk level (Low/Medium/High) based on KYC answers (source of funds, occupation, etc.)

UI COMPONENTS:
- KYC wizard: step-by-step form for personal info, document upload, address entry
- Document capture: mobile camera for real-time photo ID capture + liveness check
- Progress tracker: visual indicator of KYC completion (% of steps done)
- Status dashboard: current verification level, expiry date, rejection reasons (if any)
- Admin review interface: document viewer (side-by-side), OCR text view, approve/reject buttons
- Compliance dashboard: KYC metrics (% verified, avg review time, rejections by reason)

VALIDATION:
- First/last name: min 2 chars, max 50, letters + hyphens only
- DOB: must be 18+ years old at submission
- SSN: format validation + checksum (if US)
- Address: min 5 chars, max 255
- File upload: max 10 MB per document, allowed types (PDF, JPG, PNG)

INTEGRATIONS:
- Document verification API: automated ID verification (expires, face match, data extraction)
- Address verification API: USPS/Google address validation
- Background check API: optional risk screening
- Supabase Auth: sync with user account, lock/unlock account based on KYC status

COMPLIANCE:
- FATCA: flag high-risk countries, require additional docs for sanctioned jurisdictions
- BSA/AML: suspicious activity detection (rapid account creation, large transactions early)
- Document retention: store encrypted documents 7 years post-closure
```

---

## 6. Newsletter & Email Marketing

**Task:** Email templates, subscriber management, SMTP integration  
**Status:** Phase 1 critical

```
Create newsletter and email communication system in Airo:

ENTITIES:
- Subscriber (subscriberId, email, firstName, lastName, subscriptionStatus, preferences, subscribedAt, unsubscribedAt)
  - Status: Active, Unsubscribed, Bounced, Complained, Inactive (90+ days no opens)
  - Preferences: Marketing emails, Transaction alerts, Product updates (granular opt-in)
  - Double opt-in: confirmation email required before activation

- EmailTemplate (templateId, name, subject, htmlBody, plainTextBody, variables, previewText, category, createdAt, updatedAt)
  - Categories: Marketing, Transactional, Alert, Newsletter, Onboarding
  - Variables: {{firstName}}, {{accountBalance}}, {{transactionAmount}}, etc. (Handlebars)
  - Preview text: 40-char description for email client preview

- NewsletterCampaign (campaignId, name, templateId, audienceSegment, scheduledAt, sentAt, status, metrics)
  - Status: Draft, Scheduled, Sending, Sent, Failed
  - Audience segment: All, ByAccountType, ByGeography, ByActivity, Custom filter
  - Metrics: deliveryRate, openRate, clickRate, unsubscribeRate

- EmailDeliveryLog (logId, campaignId/transactionId, toEmail, status, timestamp, bounceReason, clickedLinks)
  - Status: Queued, Sending, Delivered, Bounced, Complained, Opened, Clicked
  - Bounce reason: Permanent (invalid email), Temporary (server down)
  - Click tracking: record which links clicked + timestamp

- Unsubscribe (unsubscribeId, email, reason, timestamp, emailAddress)
  - Reason: TooFrequent, NotRelevant, NotInterested, Spam, Other
  - One-click unsubscribe (per CAN-SPAM)
  - No re-subscription without explicit opt-in

BUSINESS LOGIC:
- Double opt-in: send confirmation email, don't add to list until clicked
- Suppression list: never send to bounced or complained addresses
- Preference respect: check subscriber preferences before sending
- Personalization: merge template variables with subscriber data
- Cadence limits: max 2 marketing emails per week (avoid fatigue)
- Re-engagement: mark inactive after 90 days, send win-back campaign once

UI COMPONENTS:
- Email template builder: drag-drop WYSIWYG editor + code view (HTML/Handlebars)
- Campaign creation wizard: select template, define audience, schedule send
- Subscriber management: bulk import (CSV), export, segment creation, preference management
- Campaign analytics: real-time delivery/open/click rates, unsubscribe tracking
- A/B testing: subject line variants, send to 10% sample, choose winner
- Unsubscribe page: list preferences, allow selective unsubscribe by category

VALIDATION:
- Email format: standard RFC 5322 regex validation
- Template variables: warn if variable used but not defined in data source
- Campaign scheduling: prevent past dates, require >1 hour lead time
- Audience size: require minimum 10 subscribers before send (spam prevention)

INTEGRATIONS:
- Zoho Mail SMTP (OAuth): send via citygate@zohomail.com (or branded domain)
- Supabase Auth: sync subscriber list with user accounts (double opt-in check)
- Bounce handling: parse SMTP delivery status notifications (DSN), auto-suppress
- Link tracking: redirect all links through tracking endpoint (utm parameters)
- Webhook: on unsubscribe, update Subscriber status immediately

COMPLIANCE:
- CAN-SPAM: physical address in footer, From line accuracy, unsubscribe honored within 10 days
- GDPR: explicit consent before sending, easy unsubscribe, right to deletion
- CASL (Canada): Express consent required, unsubscribe within 10 days
```

---

## 7. CMS & Website

**Task:** Homepage, blog, knowledge base, content management  
**Status:** Phase 1 critical

```
Create content management system and website in Airo:

ENTITIES:
- Page (pageId, slug, title, description, content, layout, status, publishedAt, author, updatedAt)
  - Slugs: home, about, features, pricing, security, faq, contact
  - Layouts: Landing, BlogPost, KnowledgeBase, Pricing, Contact
  - Status: Draft, Published, Archived
  - Content: rich HTML with embedded forms, CTAs

- BlogPost (postId, slug, title, excerpt, body, category, tags, author, publishedAt, updatedAt, viewCount)
  - Categories: Product Updates, Security, Financial Tips, Guides
  - Tags: searchable, displayed on page
  - View tracking: increment on page load (analytics)
  - Related posts: auto-suggest 3 posts with similar tags

- KnowledgeBaseArticle (articleId, slug, title, content, category, tags, author, publishedAt, updatedAt, helpfulCount)
  - Categories: Getting Started, Accounts, Transfers, Fees, Troubleshooting, Security
  - Helpful votes: upvote/downvote for feedback loop
  - Search indexing: full-text search across title + content

- MediaLibrary (mediaId, filename, fileType, fileSize, uploadedAt, alt, description, url)
  - Types: Image, PDF, Video
  - Storage: Render file storage or S3
  - Alt text: required for accessibility

- ContactFormSubmission (submissionId, name, email, subject, message, submittedAt, status)
  - Status: Received, Read, Replied, Closed
  - Auto-reply: confirm receipt within 1 hour
  - Admin notification: new submission alert

BUSINESS LOGIC:
- Page publishing: auto-save drafts, publish to live CDN on approval
- Blog search: full-text search on title + excerpt + body + tags
- Knowledge base search: faceted search by category, sorting by helpfulness
- View analytics: track page views, bounce rate, average time on page
- Content versioning: maintain previous versions, allow rollback
- SEO: auto-generate meta tags, sitemap, structured data (Schema.org)

UI COMPONENTS:
- WYSIWYG page editor: drag-drop layout builder, rich text editor, image/video upload
- Blog management: calendar view for publishing schedule, bulk edit tags
- Knowledge base search: faceted filters, helpful votes display, related articles sidebar
- Content preview: live preview before publish, mobile responsive check
- Analytics dashboard: page views, traffic sources, top pages, bounce rates
- Media library: thumbnail gallery, upload new, crop/resize images

VALIDATION:
- Page slug: unique, lowercase, hyphens only (no spaces/special chars)
- Title: min 10 chars, max 100
- Content: min 50 chars (prevent empty pages)
- Image alt text: required for accessibility
- Contact form: email valid, message min 10 chars

INTEGRATIONS:
- Supabase Auth: track author (login required to publish)
- SendGrid Email: send contact form submissions to support@citygatecapital.com
- CDN: Render static asset caching, instant cache invalidation on publish
- Search index: Algolia or Supabase full-text search for blog/KB

COMPLIANCE:
- WCAG 2.1 AA: alt text on images, color contrast, keyboard navigation
- GDPR: cookie consent banner, privacy policy linked
- Security: no hardcoded credentials, HTTPS enforcement
```

---

## 8. Premium Card Visual & Branding

**Task:** Card design, virtual card generation, visual assets  
**Status:** Phase 1 critical

```
Create premium card and branding system in Airo:

ENTITIES:
- CardDesign (designId, name, cardType, background, gradientColors, logoPosition, accentColor, status)
  - Card types: Premium (custom design), Standard (simple)
  - Background: solid color, gradient, image, pattern
  - Design status: Draft, Active, Archived

- PhysicalCard (cardId, userId, designId, cardNumber (masked), expiryDate, cvv (encrypted), status, issuedAt, requestedAt)
  - Number: masked except last 4 digits
  - CVV: encrypted at rest, never logged
  - Status: Pending, Issued, Active, Locked, Expired, Closed
  - Issuance: partner with Stripe/Marqeta for physical production

- VirtualCard (virtualCardId, userId, designId, cardNumber (encrypted), expiryDate, cvv (encrypted), limits, createdAt, expiresAt)
  - Instant issuance (no production time)
  - Spending limit: optional daily/monthly cap
  - Expiry: 3 years from creation
  - Pause/resume functionality (freeze without deletion)

- CardWidget (widgetId, userId, cardId, displayFormat, showCardNumber, cardholderName)
  - Display formats: Full card view, Card preview, Last 4 digits only
  - Show card number: toggle for privacy
  - Cardholder name: display on widget

BUSINESS LOGIC:
- Physical card ordering: submit request → production (7-14 days) → shipping → activation
- Virtual card creation: instant generation, ready for use immediately
- Card activation: require SMS verification code before first transaction
- Spending limits: enforce per-transaction max + rolling 24-hour/30-day caps
- Fraud detection: flag unusual spending (high amount, unusual merchant, geographic anomaly)
- Card locking: auto-lock if detected fraud, notify user + require unlock via 2FA

UI COMPONENTS:
- Card design gallery: browse premium designs, customize colors, preview on mock card
- Physical card order form: shipping address, expedited option, delivery tracking
- Virtual card dashboard: create instant card, set spending limits, pause/resume, view balance
- Card management: view all cards (physical + virtual), lock/unlock, report lost/stolen
- Transaction history: per-card spending, merchant categories, fraud alerts

VALIDATION:
- Card number: 16 digits, Luhn checksum validation
- Expiry date: future date only, min 12 months
- Design colors: valid hex codes, contrast ratio >= 4.5:1 (accessibility)
- Spending limit: positive number, max $99,999

INTEGRATIONS:
- Card issuance partner: Stripe or Marqeta API for physical card production
- Merchant network: Visa/Mastercard for authorization + settlement
- 3D Secure: for high-risk online transactions
- Wallet integration: Apple Pay, Google Pay support (tokenized PAN)

COMPLIANCE:
- PCI DSS: don't store full card numbers in plaintext
- Card data encryption: AES-256 at rest
- Fraud monitoring: real-time transaction monitoring per card
```

---

## 9. Cleanup & Deployment

**Task:** Database cleanup, environment setup, deploy to production  
**Status:** Phase 1 final

```
Prepare for production deployment:

PRE-DEPLOYMENT CHECKLIST:

Database:
  [ ] Remove all test/dummy data (test accounts, fake transactions)
  [ ] Verify primary keys + foreign keys on all tables
  [ ] Add indexes on frequently queried fields (userId, status, timestamp)
  [ ] Test Supabase backup restore (ensure recoverability)
  [ ] Enable Row Level Security (RLS) on sensitive tables (user_sessions, audit_logs, ssn fields)
  [ ] Encrypt sensitive columns (ssn, card cvv, secrets) at rest

Environment:
  [ ] Create .env.production with production URLs + API keys
  [ ] Move all secrets to Airo Secrets Manager (not in code)
  [ ] Set up Supabase production database instance (separate from dev)
  [ ] Configure Render environment variables (DATABASE_URL, API_KEYS, etc.)
  [ ] Enable HTTPS enforcement (redirect HTTP → HTTPS)

Security:
  [ ] Remove all console.log() statements (prevent info leaks)
  [ ] Enable CORS only for citygate.capital domain
  [ ] Set security headers: CSP, X-Frame-Options, X-Content-Type-Options
  [ ] Verify API rate limiting enabled on all endpoints
  [ ] Test 2FA implementation (TOTP + SMS delivery)
  [ ] Run SQL injection tests on all user inputs
  [ ] Verify password hashing (bcrypt 12+ rounds)

Monitoring & Logging:
  [ ] Set up error tracking (Sentry or Datadog)
  [ ] Configure structured logging to Render logs
  [ ] Create Render monitoring alerts (CPU > 80%, Memory > 85%, Error rate > 1%)
  [ ] Set up Supabase backup schedule (daily, 30-day retention)
  [ ] Test log aggregation (Render + Supabase logs centralized)

Performance:
  [ ] Minify all CSS/JS assets
  [ ] Enable gzip compression on all responses
  [ ] Set up CDN for static assets (images, CSS, JS)
  [ ] Test mobile responsiveness on iPhone 12 + Android
  [ ] Page load time < 3 seconds (measure with Lighthouse)
  [ ] API response time < 200ms (median)

Testing:
  [ ] Run full regression test suite (Phase 2 + Phase 3)
  [ ] Load test: 1000 concurrent users on main pages
  [ ] Stress test: sudden spike to 5000 users (ensure graceful degradation)
  [ ] Test email delivery (Zoho SMTP) with 100 test sends
  [ ] Verify 2FA codes deliver within 30 seconds (SMS + Email)
  [ ] Smoke test: critical paths (login → transfer → logout)

Deployment:
  [ ] Tag production release in Git (v1.0.0)
  [ ] Create GitHub Release with changelog
  [ ] Configure GitLab CI/CD to auto-deploy on v1.x.x tag
  [ ] Dry run: deploy to Render staging environment
  [ ] Run smoke tests on staging (identical to production)
  [ ] Coordinate team for actual production deployment
  [ ] Have rollback plan + backup database ready

Post-Deployment:
  [ ] Monitor error rates for first 24 hours (target: < 0.1%)
  [ ] Monitor uptime (target: 99.9%)
  [ ] Check for any failed 2FA deliveries
  [ ] Verify transaction logs in audit trail
  [ ] Send deployment notification to stakeholders
  [ ] Schedule post-launch review meeting

DEPLOYMENT COMMAND:
```bash
# After all checks pass:
git tag v1.0.0
git push origin v1.0.0
# GitLab CI/CD auto-triggers deploy to Render
```

---

**Status:** ✅ All 9 Airo prompts generated fresh and ready for implementation.

**Next:** Proceed to Phase 2 Verification with these prompts executed.
