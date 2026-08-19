# Deployment Pre-Flight Checklist

**Do not deploy to production without completing this checklist.**

This document ensures all technical, compliance, legal, and operational requirements are met before a real-money banking platform goes live.

---

## 1. Legal & Regulatory ⚖️

- [ ] Legal team has reviewed the platform architecture and data handling
- [ ] Jurisdiction-specific banking/fintech regulations identified
- [ ] Consumer protection law compliance assessed
- [ ] Anti-money laundering (AML) / Know Your Customer (KYC) framework established
- [ ] Terms of Service (ToS) and Privacy Policy reviewed by legal counsel
- [ ] Data residency and GDPR/privacy regulations requirements confirmed
- [ ] Liability waiver and disclaimers properly documented

**Guidance**: See [`docs/compliance/`](./compliance/) for jurisdiction-specific requirements.

---

## 2. Licensing & Authorization 📜

- [ ] Money transmitter license obtained (if required in jurisdiction)
- [ ] Banking charter or equivalent regulatory approval secured
- [ ] Payment processor partnerships established and contracts signed
- [ ] Card network partnerships (Visa, Mastercard) approved
- [ ] E-money institution license (if EU/UK regulated)
- [ ] All regulatory filing deadlines met
- [ ] Regulatory approval letters/permits filed safely

---

## 3. KYC/AML Compliance 🔍

- [ ] KYC workflow implemented and tested end-to-end
- [ ] Identity verification provider(s) integrated (e.g., Onfido, Jumio)
- [ ] Document verification process live and auditable
- [ ] Sanctions screening integrated (OFAC, EU, UN lists)
- [ ] Transaction monitoring rules defined and deployed
- [ ] Suspicious activity reporting (SAR) procedures documented
- [ ] Customer risk segmentation framework active
- [ ] Audit logs capture all KYC decisions with timestamps

---

## 4. Database & Infrastructure 🗄️

- [ ] `DATABASE_URL` configured in production (Supabase Postgres)
- [ ] Flat-file (JSONL) storage disabled in production
- [ ] Database backups automated and tested (restore drills)
- [ ] Read replicas configured for high availability
- [ ] Point-in-time recovery (PITR) enabled
- [ ] All Supabase credentials stored in Vercel Secrets (never in `.env`)
- [ ] SSL/TLS enforced for all database connections
- [ ] Row-level security (RLS) policies reviewed and tested

---

## 5. Authentication & Security 🔐

- [ ] Multi-factor authentication (MFA) enabled for customer accounts
- [ ] TOTP setup tested and documented
- [ ] Session timeouts configured (recommend 15–30 minutes)
- [ ] Password requirements enforced (min length, complexity)
- [ ] Password reset flow secured with email verification
- [ ] Login rate limiting deployed to prevent brute force
- [ ] OAuth/SSO providers integrated (if applicable)
- [ ] API authentication token rotation implemented
- [ ] Server-side session validation working end-to-end

---

## 6. Data Protection 🛡️

- [ ] PII encryption at rest (database-level)
- [ ] Encryption in transit (TLS 1.2+)
- [ ] Sensitive data (card numbers, SSNs) tokenized or masked
- [ ] Data minimization review completed
- [ ] Data retention policies documented and enforced
- [ ] GDPR "right to be forgotten" workflow implemented
- [ ] Customer data export functionality working
- [ ] Audit logs immutable and monitored

---

## 7. Email & Communications 📧

- [ ] Email provider configured (Zoho Mail + Resend fallback)
- [ ] SMTP credentials secured in Vercel Secrets
- [ ] Transactional email templates reviewed (KYC, alerts, resets)
- [ ] Email delivery monitoring active
- [ ] SMS alerts configured (if applicable)
- [ ] Email rate limiting implemented
- [ ] Unsubscribe mechanisms working

---

## 8. Financial Operations 💰

- [ ] Payment processor integration tested with real transactions
- [ ] Card provisioning workflow tested
- [ ] Fund transfer mechanisms audited
- [ ] Transaction reconciliation logic verified
- [ ] Reserve account(s) established with banking partner
- [ ] Daily settlement process automated and monitored
- [ ] Disputed transaction workflow documented
- [ ] Chargeback procedures in place
- [ ] Foreign exchange rates updated automatically
- [ ] Transaction fee calculation audited

---

## 9. Monitoring & Alerting 📊

- [ ] Application error tracking (Sentry/similar) live
- [ ] Database performance monitoring enabled
- [ ] API response time thresholds configured
- [ ] Transaction anomaly detection active
- [ ] Fraud scoring rules deployed
- [ ] Daily compliance reports generated
- [ ] Alert escalation procedures documented
- [ ] On-call rotation established

---

## 10. Incident Response & Disaster Recovery 🚨

- [ ] Incident response playbook documented and team trained
- [ ] Security breach notification procedures defined
- [ ] Regulatory incident reporting procedures documented
- [ ] Backup restoration tested in staging
- [ ] Disaster recovery time/recovery point objectives (RTO/RPO) defined
- [ ] Communication templates for customer notifications ready
- [ ] Third-party vendor breach procedures established

---

## 11. Penetration Testing & Security Assessment 🔬

- [ ] Third-party security assessment scheduled (pre-launch)
- [ ] Penetration testing conducted on APIs and frontend
- [ ] Findings remediated and verified
- [ ] Code review completed by external security firm
- [ ] OWASP Top 10 checklist verified
- [ ] Dependency scanning for known vulnerabilities active
- [ ] Annual security assessment budgeted

---

## 12. Testing & QA 🧪

- [ ] End-to-end tests passing in staging
- [ ] Load testing completed (expected capacity + 50%)
- [ ] Database migration tested in staging
- [ ] Rollback procedures tested
- [ ] All critical user flows tested on production-equivalent setup
- [ ] KYC workflow tested with edge cases
- [ ] Payment processing tested with test merchants

---

## 13. Documentation 📚

- [ ] API documentation complete and tested
- [ ] Runbook created for common operational tasks
- [ ] Compliance documentation compiled (for regulators)
- [ ] Internal audit procedures documented
- [ ] Staff training materials prepared
- [ ] Customer support playbooks written

---

## 14. Stakeholder Sign-Off ✅

- [ ] Legal approval obtained
- [ ] Compliance team sign-off
- [ ] Security team sign-off
- [ ] Operations team ready
- [ ] Executive approval to launch

---

## Launch Day ✈️

- [ ] Final systems check (all services healthy)
- [ ] On-call team briefed and standing by
- [ ] Customer communications draft ready
- [ ] Monitoring dashboards live
- [ ] Incident response contacts verified
- [ ] **Proceed to production deployment**

---

## Post-Launch 📋

- [ ] Monitor error rates and performance continuously
- [ ] KYC queue and approval rates tracked
- [ ] Daily compliance reporting running
- [ ] Weekly security review meetings scheduled
- [ ] Quarterly regulatory audits scheduled

---

**For jurisdiction-specific requirements, see [`docs/compliance/`](./compliance/).**
