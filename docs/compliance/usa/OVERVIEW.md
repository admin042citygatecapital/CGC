# United States: Money Transmitter Compliance Overview

## Regulatory Framework

Money transmission in the United States is regulated primarily at the **state level**, with federal oversight by the **FinCEN** (Financial Crimes Enforcement Network), **SEC** (Securities and Exchange Commission), and **CFPB** (Consumer Financial Protection Bureau).

### Key Authorities

| Authority | Focus | Website |
|---|---|---|
| **FinCEN** | AML/CFT enforcement, reporting requirements | [fincen.gov](https://www.fincen.gov/) |
| **OCC** | National banks, federal charters | [occ.treas.gov](https://www.occ.treas.gov/) |
| **NYDFS** | New York banking and financial services | [dfs.ny.gov](https://www.dfs.ny.gov/) |
| **CFPB** | Consumer protection, complaint handling | [consumerfinance.gov](https://www.consumerfinance.gov/) |
| **State Regulators** | Money transmitter licensing in each state | Varies by state |

---

## Business Classification

Determine which regulatory category applies to your platform:

### 1. **Money Transmitter / Money Services Business (MSB)**

If you:
- Accept customer funds and transmit them to another location
- Issue prepaid cards or stored value products
- Exchange currencies

**You likely need**: State money transmitter license(s) + FinCEN MSB registration

### 2. **Payment Processor**

If you facilitate payments between merchants and their customers (like Stripe, Square)

**You likely need**: Acquiring license, partnership with licensed acquirer, or MSB license

### 3. **Investment Platform / Broker-Dealer**

If you allow users to buy/sell securities, cryptocurrencies, or derivatives

**You likely need**: SEC registration as Broker-Dealer + state licenses

### 4. **Bank**

If you accept deposits and offer lending

**You likely need**: Federal or state banking charter (OCC or state regulator)

---

## State Money Transmitter Licensing

### Multi-State Strategy

Most fintech platforms must obtain licenses in **multiple states** to operate nationwide:

1. **Low-risk states first** (easier, faster licensing):
   - Colorado, Illinois, Mississippi, Montana, Wyoming
   - ~$5K–$15K application fees
   - 2–4 month approval timelines

2. **High-population states** (necessary for scale):
   - California, New York, Texas, Florida
   - $25K–$100K+ application fees
   - 4–12 month approval timelines

3. **Restrictive states** (complex requirements):
   - New York (BitLicense — see [NEW_YORK.md](./NEW_YORK.md))
   - California (additional disclosures)
   - Texas (higher net worth requirements)

### Application Requirements (Typical State)

- Articles of Incorporation / Operating Agreement
- Detailed Business Plan
- Anti-Money Laundering (AML) Compliance Program
- Know Your Customer (KYC) Procedures
- Cybersecurity Plan
- Financial Statements (audited)
- Fingerprint Cards (all principals, directors, officers)
- Personal Financial Statements
- Background investigation consent
- Surety Bond ($100K–$500K depending on state)
- Net Worth Certification ($250K–$1M depending on state)

---

## Federal Compliance: FinCEN

### Money Services Business (MSB) Registration

**Who must register**: Any entity engaged in transmitting money.

**How**: Register online at [fincen.gov/msbregistration](https://www.fincen.gov/msbregistration)

**When**: Within 180 days of commencing business (or renewal annually)

**Cost**: Free

### AML/CFT Program Requirements

Your platform must have a written AML program including:

1. **AML Officer** — Designated compliance officer
2. **Customer Due Diligence (CDD)** — Collect and verify customer information
   - Name, address, DOB
   - Tax identification number
   - Beneficial ownership information (if business customer)
3. **Enhanced Due Diligence (EDD)** — For high-risk customers
4. **Transaction Monitoring** — Detect suspicious patterns
5. **Suspicious Activity Reports (SARs)** — File with FinCEN if suspicious activity ≥ $5,000
6. **Currency Transaction Reports (CTRs)** — File if customer deposits/withdrawals ≥ $10,000 per day
7. **Record Keeping** — Maintain transaction records for 5 years
8. **Staff Training** — Annual AML training for employees

### AML Red Flags to Monitor

- Unusual transaction patterns (structuring)
- Use of third-party accounts
- Rapid movement of funds
- High-velocity transactions
- Customers in sanctioned countries
- Customers on OFAC/EU/UN watchlists
- Customers in high-risk jurisdictions

---

## Consumer Protection (CFPB)

### Unfair, Deceptive, Abusive Acts or Practices (UDAAP)

Your platform must not engage in practices that are:

- **Unfair** — Causes substantial injury not reasonably avoidable and not outweighed by benefits
- **Deceptive** — Makes material misrepresentations
- **Abusive** — Takes unreasonable advantage of consumer vulnerabilities

### Requirements

- Clear, conspicuous disclosures (ToS, Privacy Policy)
- Dispute resolution procedures
- Refund/reversal procedures for errors
- Data security practices
- Non-discriminatory pricing/service

### CFPB Complaint Handling

- Monitor and respond to complaints submitted to [consumercomplaints.gov](https://www.consumercomplaints.gov/)
- Maintain complaint log
- Provide timely resolution

---

## State Compliance Checklist

Complete this for **each state** you operate in:

- [ ] Money Transmitter License application filed
- [ ] Surety Bond procured
- [ ] Net Worth requirements met
- [ ] AML/KYC procedures documented
- [ ] State-specific disclosures implemented
- [ ] Consumer protection policies in place
- [ ] Background checks completed for all principals
- [ ] License renewal dates scheduled
- [ ] State exam/audit readiness assessed

---

## Timeline & Budget

### Licensing Timeline

- **Months 1–3**: Prepare documentation, build compliance framework
- **Months 3–6**: Submit applications to initial batch of low-risk states
- **Months 6–9**: First licenses issued; expand to moderate-risk states
- **Months 9–15**: High-population and restrictive states (concurrent)
- **Month 15+**: Nationwide operation ready

### Budget Estimate (First Year)

| Item | Cost |
|---|---|
| 5 low-risk state licenses | $50K–$75K |
| 5 medium-risk state licenses | $100K–$150K |
| New York BitLicense | $200K–$500K |
| Consulting/Legal | $150K–$300K |
| Surety bonds (multi-state) | $50K–$150K |
| Compliance staff (annual) | $100K–$200K |
| **Total First Year** | **$650K–$1.375M** |

---

## Key Resources

- **FinCEN**: [fincen.gov](https://www.fincen.gov/)
- **CFPB**: [consumerfinance.gov](https://www.consumerfinance.gov/)
- **OCC**: [occ.treas.gov](https://www.occ.treas.gov/)
- **State Money Transmitter League**: [stmtl.org](https://www.stmtl.org/)
- **NACM** (National Association of Commissioners): [nccusl.org](https://www.nccusl.org/)

---

## Next Steps

1. **Engage legal counsel** specializing in fintech/money transmission
2. **Conduct regulatory gap analysis** for your specific business model
3. **Prioritize state licensing** (start with low-risk, expand progressively)
4. **Build AML/compliance infrastructure** before submitting applications
5. **Plan for multi-year rollout** — Licensing is a 12–24 month process for nationwide coverage

---

**⚠️ Disclaimer**: This guide is informational only and does not constitute legal or regulatory advice. Consult with licensed legal counsel before proceeding.

**Last Updated**: 2026-08-19
