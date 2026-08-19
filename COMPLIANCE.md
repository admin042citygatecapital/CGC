# Compliance & Legal Disclaimer

## Important Notice

**This software is a banking-platform codebase, not regulatory authorization to accept deposits, custody assets, issue cards, or move real customer funds.**

### Before Production Deployment

The following requirements **must be completed for every jurisdiction** before any real-money launch:

- **Legal**: Jurisdiction-specific banking/fintech regulations, consumer protection laws, anti-money laundering (AML) statutes
- **Licensing**: Money transmitter licenses, banking charters, or equivalent regulatory approval
- **Compliance**: KYC/AML procedures, transaction monitoring, sanctions screening, audit trails, recordkeeping
- **Providers**: Vetted payment processors, banking partners, card networks (Visa, Mastercard, etc.)
- **Reconciliation**: Automated daily settlement, fund management, reserve accounts
- **Monitoring**: Real-time fraud detection, anomaly alerts, transaction risk scoring
- **Incident Response**: Security breach procedures, customer notification protocols, regulator reporting
- **Penetration Testing**: Third-party security assessments before launch and annually thereafter

### What This Code Provides

This repository contains:

✅ Full-stack technical infrastructure for a digital banking platform  
✅ Customer-facing accounts, cards, transfers, and trading interfaces  
✅ Internal admin panel for KYC, compliance, and support workflows  
✅ Authentication, authorization, and session management  
✅ Database schema and ORM for financial data  

### What This Code Does NOT Provide

❌ Regulatory authorization or license to operate as a financial institution  
❌ Guarantee of compliance with banking regulations in any jurisdiction  
❌ Legal opinions or compliance certifications  
❌ Payment processing or fund settlement capabilities (depends on licensed partners)  
❌ Insurance, guarantees, or liability protection  

### Configuration for Production

Production startup fails when critical configuration is absent. At minimum, configure:

- **Database**: Supabase Postgres (never use flat-file storage in production)
- **Email Provider**: Zoho Mail or similar for KYC, transaction, and security notifications
- **Authentication**: TOTP, session management, and login security hardened
- **Public Registration**: Disabled by default; enable only with complete KYC/AML procedures

**Never deploy:**
- Demo/test accounts in production
- Flat-file (JSONL) persistence
- Development credentials or API keys
- Unencrypted PII or financial data

### Liability

**Use of this software is at your own risk.** The authors and contributors make no warranties, express or implied, regarding the suitability of this code for any regulatory environment or financial purpose.

### Support & Questions

For compliance guidance specific to your jurisdiction, consult:
- Your legal and compliance team
- Regulatory bodies in your jurisdiction
- Licensed fintech compliance consultants
- Your payment processor and banking partners

---

**Last Updated**: 2026-08-19
